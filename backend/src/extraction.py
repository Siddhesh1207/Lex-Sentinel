import os
import time
import itertools
import re
import pandas as pd
from pathlib import Path
from tqdm import tqdm
from groq import Groq
from .embeddings import retrieve_for_contract # Import at the top

from .utils import CLAUSE_TYPES, CRITICAL_CLAUSES, RESULTS_DIR, CONTRACTS_DIR

# ── Key pool setup ─────────────────────────────────────────────────────────────
GROQ_KEYS = [
    os.getenv(f"GROQ_API_KEY_{i}")
    for i in range(1, 6)
    if os.getenv(f"GROQ_API_KEY_{i}")
]
if not GROQ_KEYS:
    raise ValueError(
        "No Groq API keys found. Set at least GROQ_API_KEY_1 in your .env file.\n"
        "Get a free key at https://console.groq.com"
    )

print(f"[Groq] Loaded {len(GROQ_KEYS)} API key(s). "
      f"Daily capacity: {len(GROQ_KEYS) * 14400:,} requests.")

_key_cycle = itertools.cycle(GROQ_KEYS)
_request_count = 0
_REQUEST_DELAY = 2.1   # seconds between calls to stay under 30 req/min safely


# ── Core Groq call with retry + rotation ──────────────────────────────────────
def _groq_call(prompt: str, max_retries: int = 6) -> str:
    global _request_count
    for attempt in range(max_retries):
        try:
            client = Groq(api_key=next(_key_cycle))
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", # CHANGED FROM 3.1 to 3.3
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=350,
            )
            _request_count += 1
            time.sleep(_REQUEST_DELAY)
            return resp.choices[0].message.content.strip()
        except Exception as e:
            err = str(e).lower()
            if "rate_limit" in err or "429" in err:
                wait = min(60, 2 ** (attempt + 1))
                print(f"\n[Rate limit] Waiting {wait}s before retry {attempt+1}/{max_retries}...")
                time.sleep(wait)
                continue
            if "503" in err or "502" in err:
                time.sleep(5)
                continue
            raise
    raise RuntimeError(f"Groq call failed after {max_retries} retries.")


# ── Extraction prompt ──────────────────────────────────────────────────────────
EXTRACTION_PROMPT = """You are a legal contract analyst specializing in pharmaceutical vendor agreements and clinical trial contracts (CROs, site agreements, SOWs).

CONTRACT NAME: {contract_name}

RELEVANT CONTRACT TEXT:
\"\"\"
{context}
\"\"\"

TASK: Determine if a "{clause_type}" clause is present in the contract text above.

STRICT RULES:
- Only use the text provided. Do not use general knowledge.
- If the clause IS present: STATUS must be PRESENT.
- If the clause is NOT present or cannot be confirmed: STATUS must be ABSENT.
- EXCERPT must be verbatim text from the contract (max 2 sentences). Use N/A if ABSENT.
- Be conservative — if unsure, choose ABSENT.

Respond in EXACTLY this format (4 lines, no extra text):
STATUS: [PRESENT or ABSENT]
EXCERPT: [exact quote or N/A]
SECTION: [section/page number if visible, else N/A]
CONFIDENCE: [HIGH, MEDIUM, or LOW]"""


# ── Parse LLM response ─────────────────────────────────────────────────────────
def _parse_response(text: str) -> dict:
    result = {
        "status": "ABSENT",
        "excerpt": "N/A",
        "section": "N/A",
        "confidence": "LOW"
    }
    patterns = {
        "status":     r"STATUS:\s*(PRESENT|ABSENT)",
        "excerpt":    r"EXCERPT:\s*(.+?)(?=\nSECTION:|\nCONFIDENCE:|$)",
        "section":    r"SECTION:\s*(.+?)(?=\nCONFIDENCE:|$)",
        "confidence": r"CONFIDENCE:\s*(HIGH|MEDIUM|LOW)",
    }
    for key, pat in patterns.items():
        m = re.search(pat, text, re.IGNORECASE | re.DOTALL)
        if m:
            result[key] = m.group(1).strip()
    # Sanity check
    if result["status"] not in ("PRESENT", "ABSENT"):
        result["status"] = "ABSENT"
    return result


def extract_single_clause(
    contract_name: str,
    vectorstore,       # <--- Pass vectorstore instead of raw text
    clause_type: str,
) -> dict:
    """
    Extract one clause using Semantic RAG context instead of blind keywords.
    """
    # 1. Use Qdrant to find the top 4 most semantically similar chunks
    relevant_docs = retrieve_for_contract(vectorstore, contract_name, query=clause_type, k=4)
    
    if not relevant_docs:
         return {
             "contract_name": contract_name, 
             "clause_type": clause_type, 
             "status": "ABSENT", 
             "excerpt": "N/A", 
             "section": "N/A", 
             "confidence": "LOW"
         }

    # 2. Stitch the best chunks together for Groq
    context = "\n\n...\n\n".join([doc.page_content for doc in relevant_docs])

    prompt = EXTRACTION_PROMPT.format(
        contract_name=contract_name,
        context=context[:4500],   # Groq 70B can handle this easily
        clause_type=clause_type,
    )

    try:
        raw = _groq_call(prompt)
        parsed = _parse_response(raw)
    except Exception as e:
        print(f"\n[Error] {contract_name} / {clause_type}: {e}")
        parsed = {"status": "ABSENT", "excerpt": "N/A", "section": "N/A", "confidence": "LOW"}

    return {
        "contract_name": contract_name,
        "clause_type":   clause_type,
        "status":        parsed["status"],
        "excerpt":       parsed["excerpt"],
        "section":       parsed["section"],
        "confidence":    parsed["confidence"],
    }


# ── All clauses for one contract ───────────────────────────────────────────────
def extract_all_for_contract(
    contract_name: str,
    vectorstore,
) -> list[dict]:
    results = []
    for clause_type in CLAUSE_TYPES:
        r = extract_single_clause(contract_name, vectorstore, clause_type)
        results.append(r)
    return results


# ── Batch: all contracts ───────────────────────────────────────────────────────
def batch_extract_all(
    contracts: list[dict],   
    vectorstore,             # <--- Now accepts vectorstore
    skip_existing: bool = True,
) -> pd.DataFrame:
    
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    wide_path    = RESULTS_DIR / "extraction_results.parquet"
    details_path = RESULTS_DIR / "extraction_details.parquet"

    existing_names: set = set()
    all_details: list   = []

    if skip_existing and details_path.exists():
        existing_df   = pd.read_parquet(details_path)
        existing_names = set(existing_df["contract_name"].unique())
        all_details   = existing_df.to_dict("records")
        print(f"[Resume] Found {len(existing_names)} already-processed contracts. Skipping.")

    pending = [c for c in contracts if c["contract_name"] not in existing_names]
    
    if not pending:
        print("No new contracts to extract.")
        return pd.read_parquet(wide_path)

    total_calls = len(pending) * len(CLAUSE_TYPES)
    est_hours   = total_calls * _REQUEST_DELAY / 3600
    print(f"\n[Extraction] {len(pending)} contracts × {len(CLAUSE_TYPES)} clauses = "
          f"{total_calls:,} calls (~{est_hours:.1f}h with {len(GROQ_KEYS)} key(s))\n")

    for contract in tqdm(pending, desc="Contracts"):
        rows = extract_all_for_contract(contract["contract_name"], vectorstore)
        all_details.extend(rows)

        # Save checkpoint after every contract
        details_df = pd.DataFrame(all_details)
        details_df.to_parquet(details_path, index=False)

    # Build wide matrix
    details_df = pd.DataFrame(all_details)
    wide_df = details_df.pivot_table(
        index="contract_name",
        columns="clause_type",
        values="status",
        aggfunc="first"
    ).fillna("ABSENT")
    wide_df = wide_df.reindex(columns=CLAUSE_TYPES, fill_value="ABSENT")

    wide_df.to_parquet(wide_path)
    wide_df.to_csv(RESULTS_DIR / "extraction_results.csv")

    print(f"\n[Done] Saved results to {RESULTS_DIR}")
    return wide_df

# ── Risk scoring ───────────────────────────────────────────────────────────────
def compute_risk_scores(results_df: pd.DataFrame) -> pd.Series:
    """
    Weighted risk score per contract:
      - Critical clause ABSENT = 3 points
      - Standard clause ABSENT = 1 point
    Higher score = higher risk.
    """
    def score_row(row):
        total = 0
        for clause in CLAUSE_TYPES:
            if clause not in row.index:
                continue
            if row[clause] == "ABSENT":
                total += 3 if clause in CRITICAL_CLAUSES else 1
        return total

    return results_df.apply(score_row, axis=1).rename("risk_score")