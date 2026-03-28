import os
from langchain_core.documents import Document
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_classic.chains import ConversationalRetrievalChain  # <-- Updated
from langchain_core.prompts import (                               # <-- Updated
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from langchain_groq import ChatGroq

SYSTEM_PROMPT = """You are a contract intelligence assistant for a pharmaceutical company.
You specialize in analyzing vendor agreements, CRO (Contract Research Organization) contracts,
and clinical trial site agreements.

When answering questions:
1. Always cite your sources: name the contract and mention the section or page if available.
2. Quote the exact relevant clause text in quotation marks where possible.
3. If comparing multiple contracts, present a clear structured comparison using a markdown table.
4. If a critical clause is missing from a contract, flag it explicitly as:
   ⚠️ HIGH RISK — [clause type] not found in this contract.
5. Be precise and conservative. If you cannot confirm something from the retrieved text, say so.
6. Keep answers concise but complete. Lead with the direct answer, then provide supporting evidence."""


def get_chat_llm():
    """Try Groq first (higher rate limits with your keys), fall back to Gemini."""
    
    # 1. Primary: Groq
    groq_key = os.getenv("GROQ_API_KEY_1")
    if groq_key:
        return ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=groq_key,
            temperature=0.2,
        )
        
    # 2. Fallback: Gemini
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=gemini_key,
            temperature=0.2,
        )
        
    raise ValueError("No LLM API key found. Set GROQ_API_KEY_1 or GEMINI_API_KEY.")


def build_rag_chain(vectorstore, llm=None):
    """
    Builds a ConversationalRetrievalChain.
    If llm is None, builds a fresh Gemini instance.
    Returns the chain object.
    """
    if llm is None:
        llm = get_chat_llm()

    retriever = vectorstore.as_retriever(search_kwargs={"k": 8})

    # System prompt injected via the combine_docs_chain prompt
    qa_prompt = ChatPromptTemplate.from_messages([
        SystemMessagePromptTemplate.from_template(SYSTEM_PROMPT),
        HumanMessagePromptTemplate.from_template(
            "Context from the contract(s):\n{context}\n\n"
            "Question: {question}\n\n"
            "Answer (cite the contract name and section for each claim):"
        ),
    ])

    chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=retriever,
        return_source_documents=True,
        combine_docs_chain_kwargs={"prompt": qa_prompt},
        verbose=False,
    )

    return chain


def answer_question(
    chain,
    query: str,
    contract_filters: list[str] | None,
    chat_history: list[dict],
) -> dict:
    """
    Runs a RAG query against the contract vector store.

    Args:
        chain: ConversationalRetrievalChain built by build_rag_chain()
        query: user's question
        contract_filters: list of contract names to restrict search to (empty = all)
        chat_history: list of {"role": "user"|"assistant", "content": str}

    Returns:
        { "answer": str, "sources": list[SourceRef] }
    """
    # Convert chat_history dicts to (human, ai) tuple pairs for LangChain
    lc_history = []
    i = 0
    while i < len(chat_history) - 1:
        if chat_history[i]["role"] == "user" and chat_history[i + 1]["role"] == "assistant":
            lc_history.append((chat_history[i]["content"], chat_history[i + 1]["content"]))
            i += 2
        else:
            i += 1

    # If contract_filters provided, prepend them to the query as context for the retriever
    effective_query = query
    if contract_filters:
        filter_context = "Contracts to focus on: " + ", ".join(contract_filters) + ". "
        effective_query = filter_context + query

    result = chain.invoke({
        "question": effective_query,
        "chat_history": lc_history,
    })

    answer: str = result.get("answer", "No answer returned.")
    source_docs: list[Document] = result.get("source_documents", [])

    # De-duplicate sources by contract name
    seen: set[str] = set()
    sources: list[dict] = []
    for doc in source_docs:
        name = doc.metadata.get("contract_name", "Unknown")
        if name not in seen:
            seen.add(name)
            sources.append({
                "contract_name": name,
                "excerpt": doc.page_content[:300].strip(),
                "page_hint": doc.metadata.get("section_hint", "N/A"),
            })

    return {"answer": answer, "sources": sources}


def compare_clause_across_contracts(
    vectorstore,
    clause_type: str,
    contract_names: list[str],
    llm=None,
) -> str:
    """
    Retrieves the best chunk for a given clause from each contract,
    then asks Gemini to produce a markdown comparison table.
    Returns a markdown string.
    """
    if llm is None:
        llm = get_chat_llm()

    from .embeddings import retrieve_for_contract

    contract_excerpts = []
    for name in contract_names:
        chunks = retrieve_for_contract(vectorstore, name, clause_type, k=3)
        if chunks:
            excerpt = chunks[0].page_content[:600].strip()
        else:
            excerpt = "No relevant clause text found."
        contract_excerpts.append(f"**{name}**:\n{excerpt}")

    combined = "\n\n---\n\n".join(contract_excerpts)

    prompt = (
        f"You are a pharmaceutical contract analyst.\n\n"
        f"Compare the '{clause_type}' clause across these {len(contract_names)} contracts. "
        f"Produce a markdown table with columns: Contract Name | Clause Present | Key Terms | Risk Notes.\n\n"
        f"{combined}\n\n"
        f"Markdown comparison table:"
    )

    response = llm.invoke(prompt)
    return response.content if hasattr(response, "content") else str(response)
