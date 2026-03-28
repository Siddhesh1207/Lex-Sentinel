import argparse
import pandas as pd
from dotenv import load_dotenv
load_dotenv()  # Must be called BEFORE local imports

from src.ingestion import load_cuad_contracts, load_all_chunks
from src.embeddings import build_vector_store, load_vector_store
from src.extraction import batch_extract_all
from src.evaluation import load_ground_truth, evaluate
from src.utils import RESULTS_DIR, CUAD_JSON

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["full", "ingest", "embed", "extract", "evaluate"], default="full")
    parser.add_argument("--contracts", type=int, default=5) # Kept low for testing Groq limits
    parser.add_argument("--persist", action="store_true", default=True)
    parser.add_argument("--skip-existing", action="store_true", default=True) # Changed default to True
    
    args = parser.parse_args()
    
    contracts = load_cuad_contracts(limit=args.contracts)
    vectorstore = None
    
    # 1. Embeddings FIRST (So we can use them for semantic extraction)
    if args.mode in ["full", "embed"]:
        print("\n--- 1. BUILDING VECTOR STORE ---")
        chunks = load_all_chunks(limit=args.contracts)
        vectorstore = build_vector_store(chunks, persist=args.persist)
        
    # 2. Extraction SECOND (Using Semantic Search)
    if args.mode in ["full", "extract"]:
        print(f"\n--- 2. EXTRACTING CLAUSES ({args.contracts} contracts) ---")
        if vectorstore is None:
            vectorstore = load_vector_store()
            
        print("Running Groq clause extraction with Semantic Context...")
        wide_df = batch_extract_all(contracts, vectorstore, skip_existing=args.skip_existing)
        
    # 3. Evaluation
    if args.mode in ["full", "evaluate"]:
        print("\n--- 3. EVALUATING ACCURACY ---")
        try:
            wide_df = pd.read_parquet(RESULTS_DIR / "extraction_results.parquet")
            ground_truth_df = load_ground_truth(CUAD_JSON)
            report = evaluate(wide_df, ground_truth_df)
            print(f"Overall F1: {report['overall_f1']}")
        except FileNotFoundError:
            print("Extraction results not found. Run --mode extract first.")
            
    print("\n✅ Done! Start the API with: uvicorn main:app --reload")

if __name__ == "__main__":
    main()