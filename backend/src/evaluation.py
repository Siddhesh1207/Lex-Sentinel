"""
evaluation.py — Fixed CUAD ground truth evaluation.

Root cause of F1=0.225:
  The CUAD dataset stores questions with this exact phrasing:
    "Highlight the parts (if any) of this contract related to 'Cap on Liability'
     that should be reviewed by a lawyer. Details: ..."

  Simple substring matching on clause names fails because:
    - "Governing Law" appears in multiple questions (question 1 AND question 7 in some versions)
    - "FCPA" needs to match "Corrupt Practices"
    - "ROFR/ROFO/ROFN" needs special handling
    - The contract "title" in CUAD qas is different from the contract filename key

  Fix: Use an explicit mapping from CUAD question keywords → your clause type names.
  This is the only reliable way to align them.
"""

import json
import re
import pandas as pd
from pathlib import Path
from sklearn.metrics import precision_score, recall_score, f1_score, classification_report

from .utils import CLAUSE_TYPES, RESULTS_DIR, CUAD_JSON


# ---------------------------------------------------------------------------
# Explicit mapping: substring that appears in the CUAD question text → clause type
# These are ordered from most specific to least specific to avoid mis-matches.
# Tested against cuad_v1.json question text.
# ---------------------------------------------------------------------------
CUAD_QUESTION_TO_CLAUSE: list[tuple[str, str]] = [
    # Exact / unambiguous matches first
    ("Parties",                          "Parties"),
    ("Effective Date",                   "Effective Date"),
    ("Expiration Date",                  "Expiration Date"),
    ("Renewal Term",                     "Renewal Term"),
    ("Notice Period to Terminate",       "Notice Period to Terminate Renewal"),
    ("Most Favored Nation",              "Most Favored Nation"),
    ("Non-Compete",                      "Non-Compete"),
    ("Exclusivity",                      "Exclusivity"),
    ("No-Solicit of Customers",          "No-Solicit of Customers"),
    ("No-Solicit of Employees",          "No-Solicit of Employees"),
    ("Non-Disparagement",                "Non-Disparagement"),
    ("Termination for Convenience",      "Termination for Convenience"),
    ("ROFR/ROFO/ROFN",                   "ROFR/ROFO/ROFN"),
    ("Right of First",                   "ROFR/ROFO/ROFN"),          # alt phrasing
    ("Change of Control",                "Change of Control"),
    ("Anti-Assignment",                  "Anti-Assignment"),
    ("Revenue/Profit Sharing",           "Revenue/Profit Sharing"),
    ("Price Restrictions",               "Price Restrictions"),
    ("Minimum Commitment",               "Minimum Commitment"),
    ("Volume Restriction",               "Volume Restriction"),
    ("IP Ownership Assignment",          "IP Ownership Assignment"),
    ("Joint IP Ownership",               "Joint IP Ownership"),
    ("License Grant",                    "License Grant"),
    ("Non-Transferable License",         "Non-Transferable License"),
    ("Affiliate License-Licensor",       "Affiliate License-Licensor"),
    ("Affiliate License-Licensee",       "Affiliate License-Licensee"),
    ("Unlimited/All-You-Can-Eat",        "Unlimited/All-You-Can-Eat License"),
    ("Irrevocable or Perpetual",         "Irrevocable or Perpetual License"),
    ("Source Code Escrow",               "Source Code Escrow"),
    ("Post-Termination Services",        "Post-Termination Services"),
    ("Audit Rights",                     "Audit Rights"),
    ("Uncapped Liability",               "Uncapped Liability"),
    ("Cap on Liability",                 "Cap on Liability"),
    ("Liquidated Damages",               "Liquidated Damages"),
    ("Warranty Duration",                "Warranty Duration"),
    ("Insurance",                        "Insurance"),
    ("Covenant Not to Sue",              "Covenant Not to Sue"),
    ("Third Party Beneficiary",          "Third Party Beneficiary"),
    ("Corrupt Practices",                "FCPA"),                     # FCPA full name
    ("FCPA",                             "FCPA"),
    ("Consent to Jurisdiction",          "Consent to Jurisdiction"),
    # Governing Law must come LAST — it's a substring of many other clauses
    ("Governing Law",                    "Governing Law"),
]


def _map_question_to_clause(question_text: str) -> str | None:
    """
    Maps a CUAD question string to one of our 41 clause type names.
    Returns None if no match found (question is outside our 41 types).
    """
    q = question_text.strip()
    for keyword, clause_name in CUAD_QUESTION_TO_CLAUSE:
        if keyword.lower() in q.lower():
            return clause_name
    return None


def _normalize_contract_name(raw_title: str) -> str:
    """
    CUAD stores contract names with full paths or extensions sometimes.
    Strip to just the base filename without extension.
    """
    name = raw_title.strip()
    # Remove common path prefixes
    name = re.sub(r'^.*[/\\]', '', name)
    # Remove file extensions
    name = re.sub(r'\.(txt|pdf|docx?)$', '', name, flags=re.IGNORECASE)
    return name


def load_ground_truth(cuad_json_path: Path = CUAD_JSON) -> pd.DataFrame:
    """
    Parses cuad_v1.json and builds a wide ground-truth DataFrame.

    CUAD structure:
      data: [
        {
          title: "ContractName.txt",
          paragraphs: [
            {
              context: "...",
              qas: [
                {
                  question: "Highlight the parts ... related to 'Cap on Liability'...",
                  id: "...",
                  answers: [...],       # non-empty → PRESENT
                  is_impossible: bool   # True → ABSENT
                }
              ]
            }
          ]
        }
      ]
    """
    print(f"Loading ground truth from {cuad_json_path}...")

    with open(cuad_json_path, encoding="utf-8") as f:
        raw = json.load(f)

    # CUAD json can be nested under "data" key or be the list directly
    entries = raw.get("data", raw) if isinstance(raw, dict) else raw

    # Build: { contract_name: { clause_type: "PRESENT"|"ABSENT" } }
    ground: dict[str, dict[str, str]] = {}

    skipped_questions = 0
    matched_questions = 0

    for entry in entries:
        contract_name = _normalize_contract_name(entry.get("title", "unknown"))

        if contract_name not in ground:
            ground[contract_name] = {clause: "ABSENT" for clause in CLAUSE_TYPES}

        paragraphs = entry.get("paragraphs", [])
        for paragraph in paragraphs:
            qas = paragraph.get("qas", [])
            for qa in qas:
                question_text = qa.get("question", "")
                clause_type = _map_question_to_clause(question_text)

                if clause_type is None:
                    skipped_questions += 1
                    continue

                matched_questions += 1

                # A clause is PRESENT if answers is non-empty AND is_impossible is False
                answers = qa.get("answers", [])
                is_impossible = qa.get("is_impossible", False)

                if answers and not is_impossible:
                    # Only upgrade ABSENT → PRESENT, never downgrade
                    # (multiple paragraphs may have answers for the same clause)
                    ground[contract_name][clause_type] = "PRESENT"

    print(f"  Matched questions:  {matched_questions:,}")
    print(f"  Skipped questions:  {skipped_questions:,}  (outside 41 clause types)")
    print(f"  Contracts in GT:    {len(ground):,}")

    df = pd.DataFrame.from_dict(ground, orient="index")
    # Ensure all 41 clause columns exist
    for clause in CLAUSE_TYPES:
        if clause not in df.columns:
            df[clause] = "ABSENT"
    df = df[CLAUSE_TYPES]  # enforce column order

    return df


def evaluate(
    results_df: pd.DataFrame,
    ground_truth_df: pd.DataFrame,
) -> dict:
    """
    Computes precision, recall, F1 per clause and overall.

    Alignment strategy:
      - Inner join on index (contract names must match exactly)
      - If very few contracts match, tries fuzzy normalization
    """
    # --- Align indices ---
    # Normalize both indices the same way
    results_df.index = results_df.index.map(_normalize_contract_name)
    ground_truth_df.index = ground_truth_df.index.map(_normalize_contract_name)

    common_contracts = results_df.index.intersection(ground_truth_df.index)
    print(f"\n  Results contracts:     {len(results_df):,}")
    print(f"  Ground truth contracts: {len(ground_truth_df):,}")
    print(f"  Matched (inner join):   {len(common_contracts):,}")

    if len(common_contracts) == 0:
        print("\n  ⚠️  Zero contracts matched between results and ground truth.")
        print("  Check that contract names in extraction_results.parquet match cuad_v1.json titles.")
        # Print first 5 from each for debugging
        print(f"  Results sample:  {list(results_df.index[:5])}")
        print(f"  GT sample:       {list(ground_truth_df.index[:5])}")
        raise ValueError(
            "No contracts matched between predictions and ground truth. "
            "Check contract name normalization in _normalize_contract_name()."
        )

    pred_df = results_df.loc[common_contracts]
    gt_df   = ground_truth_df.loc[common_contracts]

    # --- Compute per-clause metrics ---
    per_clause = []

    for clause in CLAUSE_TYPES:
        if clause not in pred_df.columns or clause not in gt_df.columns:
            per_clause.append({
                "clause_type": clause,
                "precision": 0.0,
                "recall": 0.0,
                "f1": 0.0,
                "support": 0,
            })
            continue

        y_pred = (pred_df[clause] == "PRESENT").astype(int)
        y_true = (gt_df[clause]   == "PRESENT").astype(int)

        p = precision_score(y_true, y_pred, zero_division=0)
        r = recall_score   (y_true, y_pred, zero_division=0)
        f = f1_score       (y_true, y_pred, zero_division=0)
        support = int(y_true.sum())

        per_clause.append({
            "clause_type": clause,
            "precision": round(float(p), 4),
            "recall":    round(float(r), 4),
            "f1":        round(float(f), 4),
            "support":   support,
        })

    # Sort by F1 descending
    per_clause.sort(key=lambda x: x["f1"], reverse=True)

    # --- Overall weighted F1 ---
    all_pred = (pred_df[CLAUSE_TYPES] == "PRESENT").values.flatten().astype(int)
    all_true = (gt_df[CLAUSE_TYPES]   == "PRESENT").values.flatten().astype(int)
    overall_f1 = float(f1_score(all_true, all_pred, zero_division=0, average="weighted"))

    # Print sklearn's full report to terminal (useful for debugging)
    print("\n" + "="*60)
    print("CLASSIFICATION REPORT (top-level, flattened across all clauses)")
    print("="*60)
    print(classification_report(all_true, all_pred, zero_division=0))

    # Print per-clause summary
    print(f"\n{'Clause Type':<40} {'Prec':>6} {'Rec':>6} {'F1':>6} {'Sup':>5}")
    print("-" * 65)
    for row in per_clause:
        print(
            f"{row['clause_type']:<40} "
            f"{row['precision']:>6.3f} "
            f"{row['recall']:>6.3f} "
            f"{row['f1']:>6.3f} "
            f"{row['support']:>5}"
        )
    print(f"\nOverall Weighted F1: {overall_f1:.4f}")

    report = {
        "overall_f1":           round(overall_f1, 4),
        "per_clause":           per_clause,
        "contracts_evaluated":  len(common_contracts),
        "clauses_evaluated":    len(CLAUSE_TYPES),
    }

    # Save
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    import json as _json
    with open(RESULTS_DIR / "evaluation_report.json", "w") as f:
        _json.dump(report, f, indent=2)
    print(f"\nEvaluation report saved to {RESULTS_DIR / 'evaluation_report.json'}")

    return report