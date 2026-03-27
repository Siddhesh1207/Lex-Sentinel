import json
from pathlib import Path
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, classification_report
from .utils import CLAUSE_TYPES, RESULTS_DIR

def load_ground_truth(cuad_json_path: Path) -> pd.DataFrame:
    with open(cuad_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)["data"]
        
    records = []
    for doc in data:
        contract_name = doc.get("title", "Unknown").replace(".txt", "")
        # Create default dict for all clauses as ABSENT
        contract_data = {clause: "ABSENT" for clause in CLAUSE_TYPES}
        
        for p in doc.get("paragraphs", []):
            for qa in p.get("qas", []):
                q_title = qa.get("id", "").split("__")[0] # The question ID sometimes has the clause type
                # Real CUAD maps specific question text to clause type. Actually we match by prefix
                for clause in CLAUSE_TYPES:
                    if qa.get("question", "").startswith(clause):
                        answers = qa.get("answers", [])
                        is_impossible = qa.get("is_impossible", False)
                        if answers and not is_impossible:
                            contract_data[clause] = "PRESENT"
                            
        contract_data["contract_name"] = contract_name
        records.append(contract_data)
        
    df = pd.DataFrame(records).set_index("contract_name")
    return df

def evaluate(results_df: pd.DataFrame, ground_truth_df: pd.DataFrame) -> dict:
    # Inner join to align predictions with ground truth
    combined = results_df.join(ground_truth_df, lsuffix="_pred", rsuffix="_true", how="inner")
    
    per_clause = []
    
    for clause in CLAUSE_TYPES:
        if f"{clause}_pred" not in combined.columns or f"{clause}_true" not in combined.columns:
            continue
            
        y_pred = (combined[f"{clause}_pred"] == "PRESENT").astype(int)
        y_true = (combined[f"{clause}_true"] == "PRESENT").astype(int)
        
        prec = precision_score(y_true, y_pred, zero_division=0)
        rec = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        
        per_clause.append({
            "clause_type": clause,
            "precision": round(prec, 3),
            "recall": round(rec, 3),
            "f1": round(f1, 3),
            "support": int(y_true.sum())
        })
        
    per_clause.sort(key=lambda x: x["f1"], reverse=True)
    
    # Calculate overall F1 (weighted)
    total_support = sum(c["support"] for c in per_clause)
    if total_support > 0:
        overall_f1 = sum(c["f1"] * c["support"] for c in per_clause) / total_support
    else:
        overall_f1 = 0
        
    report = {
        "overall_f1": round(overall_f1, 3),
        "per_clause": per_clause,
        "contracts_evaluated": len(combined),
        "clauses_evaluated": len(CLAUSE_TYPES)
    }
    
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_DIR / "evaluation_report.json", "w") as f:
        json.dump(report, f, indent=2)
        
    return report
