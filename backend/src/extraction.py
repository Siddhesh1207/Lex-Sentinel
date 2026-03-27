import pandas as pd
import re
from tqdm import tqdm
from tenacity import retry, wait_exponential, stop_after_attempt
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from .utils import CLAUSE_TYPES, CRITICAL_CLAUSES, RESULTS_DIR

EXTRACTION_PROMPT = """
You are a legal contract analyst specializing in clinical trial vendor agreements and pharmaceutical contracts.

CONTRACT NAME: {contract_name}

RELEVANT CONTRACT SECTIONS:
{context}

TASK: Determine whether the following clause type appears in the contract sections above.
CLAUSE TYPE: {clause_type}

INSTRUCTIONS:
- Read only the text provided above. Do not infer from general knowledge.
- If the clause IS present: respond PRESENT, then provide the exact verbatim sentence(s) from the text (maximum 3 sentences).
- If the clause is NOT present or cannot be confirmed from the text: respond ABSENT.
- Be conservative: if unsure, respond ABSENT.

Respond in EXACTLY this format (no extra text):
STATUS: [PRESENT or ABSENT]
EXCERPT: [exact verbatim quote from contract text, or N/A if ABSENT]
PAGE_HINT: [any page/section number visible in the text, or N/A]
CONFIDENCE: [HIGH, MEDIUM, or LOW]
"""

def parse_extraction_response(response_text: str) -> dict:
    result = {
        "status": "ABSENT",
        "excerpt": "N/A",
        "page_hint": "N/A",
        "confidence": "LOW"
    }
    try:
        lines = response_text.strip().split("\n")
        for line in lines:
            line = line.strip()
            if line.startswith("STATUS:"):
                result["status"] = line.split(":", 1)[1].strip().strip("[]")
            elif line.startswith("EXCERPT:"):
                result["excerpt"] = line.split(":", 1)[1].strip().strip("[]")
            elif line.startswith("PAGE_HINT:"):
                result["page_hint"] = line.split(":", 1)[1].strip().strip("[]")
            elif line.startswith("CONFIDENCE:"):
                result["confidence"] = line.split(":", 1)[1].strip().strip("[]")
    except Exception:
        pass
    
    # Validation
    if result["status"] not in ["PRESENT", "ABSENT"]:
        result["status"] = "ABSENT"
    if result["confidence"] not in ["HIGH", "MEDIUM", "LOW"]:
        result["confidence"] = "LOW"
        
    return result

@retry(wait=wait_exponential(min=1, max=10), stop=stop_after_attempt(3))
def extract_single_clause(vectorstore, contract_name: str, clause_type: str, llm) -> dict:
    from .embeddings import retrieve_for_contract
    chunks = retrieve_for_contract(vectorstore, contract_name, clause_type, k=8)
    
    context = "\n\n---\n\n".join([chunk.page_content for chunk in chunks])
    
    prompt = PromptTemplate.from_template(EXTRACTION_PROMPT)
    chain = prompt | llm
    
    response = chain.invoke({
        "contract_name": contract_name,
        "context": context,
        "clause_type": clause_type
    })
    
    parsed = parse_extraction_response(response.content)
    parsed["contract_name"] = contract_name
    parsed["clause_type"] = clause_type
    
    return parsed

def extract_all_for_contract(vectorstore, contract_name: str, llm) -> list:
    results = []
    for clause_type in CLAUSE_TYPES:
        res = extract_single_clause(vectorstore, contract_name, clause_type, llm)
        results.append(res)
    return results

def batch_extract_all(vectorstore, contract_names: list, llm) -> pd.DataFrame:
    all_results = []
    
    for cn in tqdm(contract_names, desc="Extracting clauses"):
        res = extract_all_for_contract(vectorstore, cn, llm)
        all_results.extend(res)
        
    detailed_df = pd.DataFrame(all_results)
    
    # Pivot for wide matrix
    wide_df = detailed_df.pivot(index='contract_name', columns='clause_type', values='status')
    
    # Fill missing with ABSENT just in case
    wide_df = wide_df.fillna("ABSENT")
    
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    wide_df.to_parquet(RESULTS_DIR / "extraction_results.parquet")
    wide_df.to_csv(RESULTS_DIR / "extraction_results.csv")
    detailed_df.to_parquet(RESULTS_DIR / "extraction_details.parquet")
    
    return wide_df

def compute_risk_scores(results_df: pd.DataFrame) -> pd.Series:
    def get_score(row):
        score = 0
        for clause in results_df.columns:
            if row.get(clause, "PRESENT") == "ABSENT":
                weight = 3 if clause in CRITICAL_CLAUSES else 1
                score += weight
        return score
        
    return results_df.apply(get_score, axis=1).rename("risk_score")
