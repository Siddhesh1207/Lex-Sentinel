"""
FastAPI application — Clinical-Legal Sentinel backend.

Startup loads all pre-computed artifacts from disk.
No LLM calls happen during UI interactions (except /api/chat).
All heavy computation (embedding, extraction) runs offline via run_pipeline.py.
"""
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
import io
from fastapi import File, UploadFile
import PyPDF2
import pandas as pd
from dotenv import load_dotenv
load_dotenv()  # Must be called BEFORE local imports that access env variables

from src.ingestion import chunk_contract
from src.extraction import extract_all_for_contract, compute_risk_scores
from src.embeddings import load_vector_store
from src.rag_chat import get_chat_llm, build_rag_chain, answer_question, compare_clause_across_contracts
from src.utils import CLAUSE_TYPES, CRITICAL_CLAUSES, RESULTS_DIR
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Global state (populated at startup) ────────────────────────────────────────
state: dict = {
    "results_df": None,
    "details_df": None,
    "evaluation_report": None,
    "vectorstore": None,
    "rag_chain": None,
    "heatmap_cache": None,       # pre-computed at startup for <500ms response
    "pipeline_ready": False,
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all artifacts on startup. Continue even if some are missing (return 503 instead)."""
    print("Starting Clinical-Legal Sentinel API...")

    # 1. Load extraction results
    parquet_path = RESULTS_DIR / "extraction_results.parquet"
    details_path = RESULTS_DIR / "extraction_details.parquet"
    eval_path    = RESULTS_DIR / "evaluation_report.json"

    if parquet_path.exists():
        state["results_df"] = pd.read_parquet(parquet_path)
        print(f"  Loaded extraction results: {len(state['results_df'])} contracts")
    else:
        print(f"  [WARN] extraction_results.parquet not found at {parquet_path}")
        print("  Run: python run_pipeline.py --mode full --contracts 20")

    if details_path.exists():
        state["details_df"] = pd.read_parquet(details_path)
    else:
        print(f"  [WARN] extraction_details.parquet not found.")

    if eval_path.exists():
        with open(eval_path) as f:
            state["evaluation_report"] = json.load(f)
        print(f"  Loaded evaluation report: overall F1 = {state['evaluation_report'].get('overall_f1', '?'):.3f}")
    else:
        print(f"  [WARN] evaluation_report.json not found. Run --mode evaluate.")

    # 2. Pre-compute heatmap cache for fast API response
    if state["results_df"] is not None:
        df = state["results_df"]
        risk_scores = compute_risk_scores(df)
        sorted_contracts = risk_scores.sort_values(ascending=False).index.tolist()
        matrix = df.loc[sorted_contracts].values.tolist()
        state["heatmap_cache"] = {
            "contracts": sorted_contracts,
            "clause_types": CLAUSE_TYPES,
            "matrix": matrix,
            "risk_scores": risk_scores.to_dict(),
        }
        print(f"  Heatmap cache built ({len(sorted_contracts)} contracts × {len(CLAUSE_TYPES)} clauses).")

    # 3. Load vector store and build RAG chain
    try:
        state["vectorstore"] = load_vector_store()
        llm = get_chat_llm()
        state["rag_chain"] = build_rag_chain(state["vectorstore"], llm)
        print("  Vector store and RAG chain loaded.")
        state["pipeline_ready"] = True
    except FileNotFoundError as e:
        print(f"  [WARN] Vector store not found: {e}")
    except EnvironmentError as e:
        print(f"  [WARN] LLM init failed: {e}")

    print("API startup complete.\n")
    yield
    print("Shutting down.")


app = FastAPI(title="Clinical-Legal Sentinel API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str
    contract_filters: list[str] = []
    chat_history: list[dict] = []   # [{"role": "user"|"assistant", "content": str}]


class SourceRef(BaseModel):
    contract_name: str
    excerpt: str
    page_hint: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceRef]

class DraftRequest(BaseModel):
    clause_type: str

class RedlineRequest(BaseModel):
    excerpt: str

class SemanticSearchRequest(BaseModel):
    query: str

# ── Helpers ─────────────────────────────────────────────────────────────────────

def require_results():
    if state["results_df"] is None:
        raise HTTPException(
            status_code=503,
            detail="Pipeline not ready. Run: python run_pipeline.py --mode full --contracts 20"
        )


# ── Endpoints ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "pipeline_ready": state["pipeline_ready"]}


@app.get("/api/dashboard/metrics")
def dashboard_metrics():
    require_results()
    df = state["results_df"]
    risk_scores = compute_risk_scores(df)

    total_contracts = len(df)
    high_risk_count = int((risk_scores >= 15).sum())
    avg_clauses_present = round(float((df == "PRESENT").sum(axis=1).mean()), 1)
    overall_f1 = (
        round(state["evaluation_report"]["overall_f1"], 4)
        if state["evaluation_report"] else None
    )

    return {
        "total_contracts": total_contracts,
        "high_risk_count": high_risk_count,
        "avg_clauses_present": f"{avg_clauses_present} / {len(CLAUSE_TYPES)}",
        "overall_f1": overall_f1,
    }


@app.get("/api/dashboard/heatmap")
def dashboard_heatmap():
    """Pre-computed at startup — always responds in < 50ms."""
    if state["heatmap_cache"] is None:
        raise HTTPException(
            status_code=503,
            detail="Heatmap not available. Pipeline has not been run yet."
        )
    return state["heatmap_cache"]


@app.get("/api/contract/{contract_name}/clause/{clause_type}")
def clause_detail(contract_name: str, clause_type: str):
    if state["details_df"] is None:
        raise HTTPException(status_code=503, detail="Details not loaded.")

    df = state["details_df"]
    mask = (df["contract_name"] == contract_name) & (df["clause_type"] == clause_type)
    rows = df[mask]

    if rows.empty:
        raise HTTPException(status_code=404, detail=f"No data for {contract_name} / {clause_type}")

    row = rows.iloc[0].to_dict()
    row["risk_weight"] = 3 if clause_type in CRITICAL_CLAUSES else 1
    return row


@app.get("/api/contracts")
def list_contracts():
    require_results()
    return sorted(state["results_df"].index.tolist())


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    if state["rag_chain"] is None:
        raise HTTPException(
            status_code=503,
            detail="RAG chain not ready. Check GEMINI_API_KEY in .env and that the vector store exists."
        )

    result = answer_question(
        chain=state["rag_chain"],
        query=request.query,
        contract_filters=request.contract_filters or None,
        chat_history=request.chat_history[-20:],  # keep last 10 turns
    )

    sources = [SourceRef(**s) for s in result["sources"]]
    return ChatResponse(answer=result["answer"], sources=sources)


@app.get("/api/evaluation")
def evaluation_report():
    if state["evaluation_report"] is None:
        raise HTTPException(
            status_code=503,
            detail="Evaluation report not found. Run: python run_pipeline.py --mode evaluate"
        )
    return state["evaluation_report"]

@app.post("/api/draft")
def draft_clause(request: DraftRequest):
    llm = get_chat_llm()
    prompt = f"Write a standard, company-favorable '{request.clause_type}' clause for a clinical vendor agreement. Return ONLY the markdown text of the drafted clause, nothing else."
    response = llm.invoke(prompt)
    return {"draft": response.content}

@app.post("/api/redline")
def redline_clause(request: RedlineRequest):
    llm = get_chat_llm()
    prompt = f"Review the following contract excerpt. Identify any overly broad, ambiguous, or highly vendor-friendly terms. Wrap ONLY those specific short risky phrases in <mark> tags. Do not summarize or change the original text, only output the exact text provided but with <mark> tags injected where appropriate. If no risks, just return the text exactly.\n\nExcerpt:\n{request.excerpt}"
    response = llm.invoke(prompt)
    return {"redlined_text": response.content}

@app.post("/api/search/semantic")
def semantic_search(request: SemanticSearchRequest):
    require_results()
    df = state["results_df"]
    llm = get_chat_llm()
    
    clause_list_str = ", ".join(CLAUSE_TYPES)
    sys_msg = SystemMessagePromptTemplate.from_template(
        "You are a strict data-architect parsing a natural language query into JSON filters for a pandas dataframe. "
        f"Available clause columns: {clause_list_str}. "
        "Return ONLY a valid JSON object mapping clause names to either 'PRESENT' or 'ABSENT'. "
        'Example output: {{"Governing Law": "PRESENT", "IP Ownership": "ABSENT"}}. '
        "Do not include markdown blocks, just raw JSON. Omit any clauses not directly implied."
    )
    human_msg = HumanMessagePromptTemplate.from_template("{query}")
    prompt_template = ChatPromptTemplate.from_messages([sys_msg, human_msg])
    formatted_prompt = prompt_template.format_messages(query=request.query)
    
    import re
    try:
        response = llm.invoke(formatted_prompt)
        text = response.content.strip()
        # More robust JSON regex extraction
        match = re.search(r"\{.*?\}", text, re.DOTALL)
        if match:
             filters = json.loads(match.group(0))
        else:
             filters = {}
    except Exception as e:
        return {"error": f"Could not parse filter logic: {str(e)}", "filters_applied": {}, "matching_contracts": df.index.tolist()}

    matching_contracts = df.index.tolist()
    for clause, required_status in filters.items():
        if clause in df.columns:
            matching_contracts = [c for c in matching_contracts if df.loc[c, clause] == required_status]
            
    return {
        "filters_applied": filters,
        "matching_contracts": matching_contracts
    }

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    if not state["pipeline_ready"]:
        raise HTTPException(status_code=503, detail="System initializing.")
        
    try:
        # 1. Read File Text
        content = await file.read()
        contract_name = file.filename.rsplit(".", 1)[0]
        text = ""
        
        if file.filename.lower().endswith(".pdf"):
            pdf = PyPDF2.PdfReader(io.BytesIO(content))
            text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
        else:
            text = content.decode("utf-8")

        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from file.")

        # 2. Embed into Qdrant FIRST 
        from src.ingestion import chunk_contract
        chunks = chunk_contract({"contract_name": contract_name, "full_text": text})
        state["vectorstore"].add_documents(chunks)

        # 3. Extract clauses using Groq + Qdrant Semantic Context
        from src.extraction import extract_all_for_contract
        extracted_rows = extract_all_for_contract(contract_name, state["vectorstore"])
        
        # 4. Update the global DataFrame & Heatmap live
        new_df = pd.DataFrame(extracted_rows)
        wide_new = new_df.pivot_table(
            index="contract_name", columns="clause_type", values="status", aggfunc="first"
        ).fillna("ABSENT")
        wide_new = wide_new.reindex(columns=CLAUSE_TYPES, fill_value="ABSENT")

        if state["results_df"] is not None:
            # Drop old version if re-uploading, then append
            if contract_name in state["results_df"].index:
                state["results_df"] = state["results_df"].drop(index=contract_name)
            state["results_df"] = pd.concat([state["results_df"], wide_new])
        else:
            state["results_df"] = wide_new

        # Re-build heatmap cache
        from src.extraction import compute_risk_scores
        risk_scores = compute_risk_scores(state["results_df"])
        sorted_contracts = risk_scores.sort_values(ascending=False).index.tolist()
        matrix = state["results_df"].loc[sorted_contracts].values.tolist()
        state["heatmap_cache"] = {
            "contracts": sorted_contracts,
            "clause_types": CLAUSE_TYPES,
            "matrix": matrix,
            "risk_scores": risk_scores.to_dict(),
        }

        return {"status": "success", "contract_name": contract_name}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))