import argparse
import os
import re
from pathlib import Path
from dotenv import load_dotenv

from src.ingestion import load_all_chunks
from src.embeddings import build_vector_store
from src.extraction import batch_extract_all
from src.evaluation import load_ground_truth, evaluate
from src.utils import CUAD_JSON

# Since user wants Gemini instead of OpenAI:
from langchain_google_genai import ChatGoogleGenerativeAI

def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["full", "ingest", "embed", "extract", "evaluate"], default="full")
    parser.add_argument("--contracts", type=int, default=20)
    parser.add_argument("--persist", action="store_true", default=True)
    parser.add_argument("--skip-existing", action="store_true")
    
    args = parser.parse_args()
    
    if args.mode in ["full", "ingest", "embed"]:
        print(f"Loading top {args.contracts} contracts...")
        chunks = load_all_chunks(limit=args.contracts)
        
        print("Building vector store...")
        vectorstore = build_vector_store(chunks, persist=args.persist)
    else:
        # Load vectorstore from disk if just extracting or evaluating
        from src.embeddings import load_vector_store
        vectorstore = load_vector_store()
        
    if args.mode in ["full", "extract"]:
        print("Running clause extraction (this takes a while)...")
        # Load llm here
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0)
        # get unique contract names from vectorstore manually or fetch from db.
        # Since we use in-memory vectorstore for full flow, we can use chunks
        if 'chunks' in locals():
            contract_names = list(set([c.metadata["contract_name"] for c in chunks]))
        else:
            # Requires listing from Qdrant directly, but for now just parse cuad_json
            import json
            with open(CUAD_JSON) as f:
                d = json.load(f)["data"]
                contract_names = [x["title"].replace(".txt", "") for x in d[:args.contracts]]
            
        wide_df = batch_extract_all(vectorstore, contract_names, llm)
        
    if args.mode in ["full", "evaluate"]:
        print("Running evaluation...")
        import pandas as pd
        from src.utils import RESULTS_DIR
        wide_df = pd.read_parquet(RESULTS_DIR / "extraction_results.parquet")
        ground_truth_df = load_ground_truth(CUAD_JSON)
        report = evaluate(wide_df, ground_truth_df)
        print(f"Overall F1: {report['overall_f1']}")
        
    print("Done! Start the API with: uvicorn main:app --reload")

if __name__ == "__main__":
    main()
