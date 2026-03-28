"""
Embeddings module — uses BAAI/bge-large-en-v1.5 (local, free, no API key).
MTEB score: 63.6 vs text-embedding-3-large's 64.6 — difference is invisible in practice.
After first download (~1.3 GB), all inference is local and instant.
"""

import os
import time
from pathlib import Path
from langchain_core.documents import Document
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, Filter, FieldCondition, MatchValue

QDRANT_PATH = os.getenv("QDRANT_PATH", "./qdrant_storage")
COLLECTION_NAME = "cuad_contracts"
BGE_MODEL = "BAAI/bge-large-en-v1.5"
EMBEDDING_DIM = 1024  # bge-large output dimension

_embeddings_singleton = None


def get_embeddings() -> HuggingFaceBgeEmbeddings:
    """
    Returns a cached singleton embedding model.
    BGE-large needs 'query_instruction' for retrieval queries
    and 'normalize_embeddings' for cosine similarity correctness.
    """
    global _embeddings_singleton
    if _embeddings_singleton is None:
        print(f"Loading embedding model: {BGE_MODEL}  (downloads ~1.3 GB on first run)...")
        _embeddings_singleton = HuggingFaceBgeEmbeddings(
            model_name=BGE_MODEL,
            model_kwargs={"device": "cuda"},          # change to "cuda" on Colab GPU
            encode_kwargs={"normalize_embeddings": True},
            query_instruction="Represent this sentence for searching relevant passages: ",
        )
        print("Embedding model ready.")
    return _embeddings_singleton


def build_vector_store(chunks: list[Document], persist: bool = True) -> QdrantVectorStore:
    """
    Embeds all document chunks and stores them in Qdrant.
    If persist=True, saves to disk so subsequent runs skip re-embedding.
    """
    embeddings = get_embeddings()

    if persist:
        Path(QDRANT_PATH).mkdir(parents=True, exist_ok=True)
        client = QdrantClient(path=QDRANT_PATH)
    else:
        client = QdrantClient(":memory:")

    # Recreate collection from scratch each time build is called
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME in existing:
        print(f"Dropping existing collection '{COLLECTION_NAME}' for rebuild...")
        client.delete_collection(COLLECTION_NAME)

    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
    )

    vectorstore = QdrantVectorStore(
        client=client,
        collection_name=COLLECTION_NAME,
        embedding=embeddings,
    )

    # Batch to avoid memory spikes; no sleep needed (local inference)
    batch_size = 64
    total = len(chunks)
    for i in range(0, total, batch_size):
        batch = chunks[i : i + batch_size]
        vectorstore.add_documents(batch)
        done = min(i + batch_size, total)
        print(f"  Indexed {done:>5} / {total} chunks", end="\r")

    print(f"\nVector store built: {total} chunks indexed into '{COLLECTION_NAME}'.")
    return vectorstore


def load_vector_store() -> QdrantVectorStore:
    """
    Loads the persisted Qdrant store from disk.
    Raises FileNotFoundError with a helpful message if not found.
    """
    if not Path(QDRANT_PATH).exists():
        raise FileNotFoundError(
            f"No vector store found at '{QDRANT_PATH}'.\n"
            "Run: python run_pipeline.py --mode embed --contracts 20"
        )

    embeddings = get_embeddings()
    client = QdrantClient(path=QDRANT_PATH)

    return QdrantVectorStore(
        client=client,
        collection_name=COLLECTION_NAME,
        embedding=embeddings,
    )


def retrieve_for_contract(
    vectorstore: QdrantVectorStore,
    contract_name: str,
    query: str,
    k: int = 8,
) -> list[Document]:
    """
    Semantic search scoped to a single contract.
    LangChain stores metadata in Qdrant payload under the 'metadata' key.
    """
    contract_filter = Filter(
        must=[
            FieldCondition(
                key="metadata.contract_name",
                match=MatchValue(value=contract_name),
            )
        ]
    )
    return vectorstore.similarity_search(query, k=k, filter=contract_filter)
