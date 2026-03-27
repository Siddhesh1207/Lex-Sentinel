from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.messages import HumanMessage, AIMessage

SYSTEM_PROMPT = """
You are a contract intelligence assistant for a pharmaceutical company.
You specialize in analyzing vendor agreements, CRO (Contract Research Organization) contracts,
and clinical trial site agreements.

When answering questions:
1. Always cite your sources: name the contract, mention the section or page if available.
2. Quote the exact relevant clause text in quotation marks.
3. If comparing multiple contracts, present a clear structured comparison.
4. If a critical clause is missing from a contract, flag it explicitly as: ⚠️ HIGH RISK — [clause type] not found.
5. Be precise and conservative. If you cannot confirm something from the retrieved text, say so.

Context:
{context}
"""

def format_docs(docs):
    return "\n\n".join(f"CONTRACT: {doc.metadata.get('contract_name', 'Unknown')}\n{doc.page_content}" for doc in docs)

def build_rag_chain(vectorstore, llm):
    # LCEL RAG Chain
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}"),
    ])
    
    def get_retriever(filters=None):
        if filters:
             return vectorstore.as_retriever(search_kwargs={"k": 8, "filter": {"must": [{"key": "metadata.contract_name", "match": {"any": tuple(filters)}}]}})
        return vectorstore.as_retriever(search_kwargs={"k": 8})

    # We'll return a helper that can be called with filters
    def chain_func(query, filters, history):
        retriever = get_retriever(filters)
        docs = retriever.invoke(query)
        context = format_docs(docs)
        
        chain = prompt | llm | StrOutputParser()
        
        answer = chain.invoke({
            "context": context,
            "chat_history": history,
            "question": query
        })
        
        return {
            "answer": answer,
            "sources": [
                {
                    "contract_name": doc.metadata.get("contract_name", "Unknown"),
                    "excerpt": doc.page_content[:200] + "...",
                    "page_hint": doc.metadata.get("section_hint", "N/A")
                } for doc in docs
            ]
        }
        
    return chain_func

def answer_question(chain_func, query: str, contract_filters: list, chat_history: list) -> dict:
    # Convert chat_history dicts to LCEL messages
    history = []
    for h in chat_history:
        if h["role"] == "user":
            history.append(HumanMessage(content=h["content"]))
        else:
            history.append(AIMessage(content=h["content"]))
            
    return chain_func(query, contract_filters, history)

def compare_clause_across_contracts(vectorstore, clause_type: str, contract_names: list, llm) -> str:
    from .embeddings import retrieve_for_contract
    all_chunks = []
    for cn in contract_names:
        chunks = retrieve_for_contract(vectorstore, cn, clause_type, k=1)
        if chunks:
            all_chunks.extend(chunks)
            
    context = "\n\n".join([f"CONTRACT: {chunk.metadata['contract_name']}\n{chunk.page_content}" for chunk in all_chunks])
    
    prompt = f"{SYSTEM_PROMPT}\n\nTask: Compare the {clause_type} clauses across the following contracts based on this text:\n\n{context}\n\nProduce a Markdown table comparing them."
    
    res = llm.invoke(prompt)
    return res.content
