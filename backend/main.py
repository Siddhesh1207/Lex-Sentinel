from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import json
import pandas as pd
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from src.utils import RESULTS_DIR, CLAUSE_TYPES, CRITICAL_CLAUSES
from src.extraction import compute_risk_scores
from src.embeddings import load_vector_store
from src.rag_chat import build_rag_chain, answer_question
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

# Global state
app_state = {
    "results_df": None,
    "details_df": None,
    "evaluation_report": None,
    "vectorstore": None,
    "rag_chain": None,
    "pipeline_ready": False
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load state
    parquet_path = RESULTS_DIR / "extraction_results.parquet"
    details_path = RESULTS_DIR / "extraction_details.parquet"
    eval_path = RESULTS_DIR / "evaluation_report.json"
    
    if parquet_path.exists() and details_path.exists():
        app_state["results_df"] = pd.read_parquet(parquet_path)
        app_state["details_df"] = pd.read_parquet(details_path)
        app_state["pipeline_ready"] = True
        
        # Precompute risk scores
        app_state["results_df"]["risk_score"] = compute_risk_scores(app_state["results_df"])
        
    if eval_path.exists():
        with open(eval_path, "r") as f:
            app_state["evaluation_report"] = json.load(f)
            
    try:
        app_state["vectorstore"] = load_vector_store()
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0.2)
        app_state["rag_chain"] = build_rag_chain(app_state["vectorstore"], llm)
    except Exception as e:
        print(f"Warning: RAG chain failed to load: {e}")
        
    yield
    # Cleanup on shutdown
    app_state.clear()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SourceRef(BaseModel):
    contract_name: str
    excerpt: str
    page_hint: str

class ChatRequest(BaseModel):
    query: str
    contract_filters: List[str] = []
    chat_history: List[Dict[str, str]] = []

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceRef]

@app.get("/api/health")
def health_check():
    return {"status": "ok", "pipeline_ready": app_state["pipeline_ready"]}

@app.get("/api/dashboard/metrics")
def get_metrics():
    if not app_state["pipeline_ready"]:
        raise HTTPException(status_code=503, detail="Pipeline not ready")
        
    df = app_state["results_df"]
    eval_rep = app_state["evaluation_report"]
    
    total_contracts = len(df)
    high_risk_count = int((df["risk_score"] >= 15).sum())
    
    # Calculate average present clauses per contract
    # Risk score calculation already used the columns. We can sum PRESENTs across CLAUSE_TYPES
    present_cols = [c for c in df.columns if c in CLAUSE_TYPES]
    present_matrix = (df[present_cols] == "PRESENT").astype(int)
    avg_clauses_present = float(present_matrix.sum(axis=1).mean())
    
    overall_f1 = eval_rep["overall_f1"] * 100 if eval_rep else None
    
    return {
        "total_contracts": total_contracts,
        "high_risk_count": high_risk_count,
        "avg_clauses_present": f"{avg_clauses_present:.1f} / {len(CLAUSE_TYPES)}",
        "overall_f1": f"{overall_f1:.1f}%" if overall_f1 is not None else None
    }

@app.get("/api/dashboard/heatmap")
def get_heatmap():
    if not app_state["pipeline_ready"]:
        raise HTTPException(status_code=503, detail="Pipeline not ready")
        
    df = app_state["results_df"].sort_values(by="risk_score", ascending=False)
    
    contracts = df.index.tolist()
    matrix = []
    
    for _, row in df.iterrows():
        # Map PRESENT/ABSENT to 1/0 for frontend Plotly
        matrix.append([1 if row.get(c, "ABSENT") == "PRESENT" else 0 for c in CLAUSE_TYPES])
        
    return {
        "contracts": contracts,
        "clause_types": CLAUSE_TYPES,
        "matrix": matrix,
        "risk_scores": df["risk_score"].to_dict()
    }

@app.get("/api/contract/{contract_name}/clause/{clause_type}")
def get_clause_detail(contract_name: str, clause_type: str):
    if not app_state["pipeline_ready"]:
        raise HTTPException(status_code=503, detail="Pipeline not ready")
        
    details_df = app_state["details_df"]
    
    # Query specific row
    mask = (details_df["contract_name"] == contract_name) & (details_df["clause_type"] == clause_type)
    if not mask.any():
        raise HTTPException(status_code=404, detail="Clause detail not found")
        
    record = details_df[mask].iloc[0]
    
    risk_weight = 3 if clause_type in CRITICAL_CLAUSES else 1
    
    return {
        "contract_name": contract_name,
        "clause_type": clause_type,
        "status": record.get("status", "ABSENT"),
        "excerpt": record.get("excerpt", "N/A"),
        "page_hint": record.get("page_hint", "N/A"),
        "confidence": record.get("confidence", "LOW"),
        "risk_weight": risk_weight
    }

@app.get("/api/contracts")
def list_contracts():
    if not app_state["pipeline_ready"]:
        raise HTTPException(status_code=503, detail="Pipeline not ready")
        
    contracts = sorted(app_state["results_df"].index.tolist())
    return contracts

@app.post("/api/chat", response_model=ChatResponse)
def get_chat_response(request: ChatRequest):
    if not app_state["rag_chain"]:
        raise HTTPException(status_code=503, detail="Chat engine not ready")
        
    try:
        res = answer_question(
            chain=app_state["rag_chain"],
            query=request.query,
            contract_filters=request.contract_filters,
            chat_history=request.chat_history
        )
        return ChatResponse(**res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/evaluation")
def get_evaluation():
    if not app_state["evaluation_report"]:
        raise HTTPException(status_code=503, detail="Evaluation not run")
    return app_state["evaluation_report"]
