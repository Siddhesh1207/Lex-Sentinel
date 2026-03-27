import time
from typing import List
from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from tqdm import tqdm
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import os

def build_vector_store(chunks: List[Document], persist: bool = True) -> QdrantVectorStore:
    """Build Qdrant vector store from chunks."""
    # embedding-001 is a reliable standard, text-embedding-004 is the newer model.
    # Note: Using random API key will cause a 404/401 error at this step.
    embeddings = GoogleGenerativeAIEmbeddings(model="embedding-001")
    
    qdrant_path = os.getenv("QDRANT_PATH", "./qdrant_storage")
    collection_name = "cuad_contracts"
    
    if persist:
        client = QdrantClient(path=qdrant_path)
    else:
        client = QdrantClient(":memory:")
        
    # Check if collection exists, if not, create it. (Langchain handles this generally, but explicit is better)
    try:
        client.get_collection(collection_name)
    except Exception:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=768, distance=Distance.COSINE), # text-embedding-004 size is 768
        )
    
    vectorstore = QdrantVectorStore(
        client=client,
        collection_name=collection_name,
        embedding=embeddings
    )
    
    batch_size = 100
    for i in tqdm(range(0, len(chunks), batch_size), desc="Embedding chunks"):
        batch = chunks[i:i + batch_size]
        vectorstore.add_documents(batch)
        time.sleep(0.3) # Rate limit protection
        
    return vectorstore

def load_vector_store() -> QdrantVectorStore:
    qdrant_path = os.getenv("QDRANT_PATH", "./qdrant_storage")
    
    if not os.path.exists(qdrant_path):
        raise FileNotFoundError(f"Qdrant storage not found at {qdrant_path}. Run pipeline first.")
        
    embeddings = GoogleGenerativeAIEmbeddings(model="text-embedding-004")
    client = QdrantClient(path=qdrant_path)
    
    return QdrantVectorStore(
        client=client,
        collection_name="cuad_contracts",
        embedding=embeddings
    )

def retrieve_for_contract(vectorstore: QdrantVectorStore, contract_name: str, query: str, k: int = 8) -> List[Document]:
    # Semantic search filtered to specific contract
    results = vectorstore.similarity_search(
        query,
        k=k,
        filter={"must": [{"key": "metadata.contract_name", "match": {"value": contract_name}}]}
    )
    return results
