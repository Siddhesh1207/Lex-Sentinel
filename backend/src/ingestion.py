import json
import re
from typing import List, Dict
from pathlib import Path
from tqdm import tqdm
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .utils import CUAD_JSON

def load_cuad_contracts(limit: int = 510) -> List[Dict]:
    """
    Open cuad_v1.json, extract unique contract entries.
    Each contract: { "contract_name": str, "full_text": str }
    """
    if not CUAD_JSON.exists():
        raise FileNotFoundError(f"{CUAD_JSON} not found. Please download the dataset.")
        
    with open(CUAD_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    documents_data = data.get("data", [])
    contracts = []
    
    for doc in documents_data[:limit]:
        title = doc.get("title", "Unknown")
        paragraphs = doc.get("paragraphs", [])
        
        # Join all paragraphs for the full text
        full_text = "\n\n".join([p.get("context", "") for p in paragraphs])
        
        contracts.append({
            "contract_name": title.replace(".txt", ""),
            "full_text": full_text
        })
        
    return contracts

def chunk_contract(contract: Dict) -> List[Document]:
    """
    PRIMARY chunking: split by section headers using regex.
    FALLBACK chunking: RecursiveCharacterTextSplitter(1000, 200).
    """
    text = contract["full_text"]
    contract_name = contract["contract_name"]
    
    # Primary chunking pattern
    pattern = r'(?=\n\s*(?:Section|SECTION|Article|ARTICLE|§)\s+[\d.]+)'
    sections = re.split(pattern, text)
    sections = [s.strip() for s in sections if s.strip()]
    
    # Fallback chunking for very long sections
    fallback_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ". ", " "]
    )
    
    chunks = []
    chunk_index = 0
    
    for section in sections:
        if len(section) > 1500: # if a section is too long, use fallback
            sub_chunks = fallback_splitter.split_text(section)
            for sub in sub_chunks:
                chunks.append(Document(
                    page_content=sub,
                    metadata={
                        "contract_name": contract_name,
                        "chunk_index": chunk_index,
                        "section_hint": "Fallback split"
                    }
                ))
                chunk_index += 1
        else:
            chunks.append(Document(
                page_content=section,
                metadata={
                    "contract_name": contract_name,
                    "chunk_index": chunk_index,
                    "section_hint": "Section boundary"
                }
            ))
            chunk_index += 1
            
    return chunks

def load_all_chunks(limit: int = 510) -> List[Document]:
    contracts = load_cuad_contracts(limit)
    all_chunks = []
    
    for contract in tqdm(contracts, desc="Chunking contracts"):
        chunks = chunk_contract(contract)
        all_chunks.extend(chunks)
        
    return all_chunks
