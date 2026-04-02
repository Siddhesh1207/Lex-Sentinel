# 🏛️ Lex-Sentinel: Active Legal Intelligence Platform

<div align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=black" alt="React Badge"/>
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI Badge"/>
  <img src="https://img.shields.io/badge/LLM-Groq%20%2B%20Llama%203.3-F55036" alt="Groq Badge"/>
  <img src="https://img.shields.io/badge/LLM%20Fallback-Google%20Gemini-4285F4?logo=google&logoColor=white" alt="Gemini Badge"/>
  <img src="https://img.shields.io/badge/Styling-TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind Badge"/>
</div>

<br/>

**Lex-Sentinel** is an enterprise-grade contract intelligence platform designed specifically for pharmaceutical and clinical vendor risk management. It transforms passive PDF contracts into an active, dynamic matrix of discoverable risks and provides generative tools to remediate those risks instantly. 

---

## 🚨 The Problem

In the pharmaceutical and med-tech industries, legal teams spend hundreds of hours manually reviewing massive, 80+ page Master Clinical Trial Agreements and vendor Statements of Work. 

The primary goal of this manual review is to spot missing or highly unfavorable critical risk clauses—such as *Caps on Liability*, *Audit Rights*, or *IP Ownership*. 
* **High Risk of Human Error:** Missing a single indemnification clause can expose a company to millions in liability.
* **Failure of Legacy Tools:** Traditional automated tools rely on fragile keyword searches that cannot handle semantic legal variations (e.g., looking for the word "indemnify" when the contract uses "hold harmless").
* **LLM Bottlenecks:** Naively stuffing an entire 80-page PDF into a standard LLM is incredibly slow, expensive, and prone to hallucinations or context-window limits.

## 💡 The Solution

Lex-Sentinel completely overhauls the legal review workflow using an **"Embed First, Extract Second"** architecture. 

Instead of overwhelming an LLM with an entire document, the platform chunks and embeds contracts into a local vector database. It then uses semantic search to find the exact relevant paragraphs and feeds only those precise contexts to ultra-fast LLMs (Llama 3.3 via Groq). This allows the system to not only **find** complex legal problems with high accuracy but actively **fix** them by auto-drafting remediations and redlining dangerous text in seconds.

---

## 🚀 Key Features

### 1. 📊 Dynamic Matrix Dashboard
Upload complex legal PDFs and watch Lex-Sentinel instantly parse them into a live heatmap. The system scores standard corporate clauses as `PRESENT` (green) or `ABSENT` (red), allowing legal teams to visualize operational risk across dozens of agreements at a glance.

### 2. ⚡ The "Auto-Drafter" (Active Remediation)
When Lex-Sentinel detects a missing critical clause (e.g., an absent *Audit Right* or *Cap on Liability*), it doesn't just alert you. With a single click, our **LLM Auto-Drafter** instantly generates a legally-sound, company-favorable template clause perfectly tailored to the clinical vendor context to insert into your counter-offer.

### 3. 🛡️ Redline Risk Highlighter 
For clauses that *do* exist, Lex-Sentinel acts as your senior counsel. Highlighted contract excerpts can be passed through the **Redline Engine**, which utilizes LLM semantics to surgically identify, wrap, and highlight overly broad, ambiguous, or highly vendor-friendly terms within the text.

### 4. 🧠 Semantic "Discovery" Engine
Don't write SQL or click through endless filter trees. Use the **Discovery** tab to search naturally: *"Show me all contracts missing IP Ownership."* The backend LLM parses the natural language, dynamically maps it to JSON schemas, and live-filters the underlying Pandas dataframes. 

### 5. 💬 Contract Intelligence RAG Center
A fully interactive Chat interface powered by LangChain. Select specific vendor agreements and ask complex comparative questions. The system leverages dense vector embeddings to cite exact contract page excerpts while comparing terms logically.

---

## 🛠️ Technology Stack

* **Frontend Interface:** React.js mapped via Vite, meticulously styled with TailwindCSS for a premium Enterprise Dark-Mode aesthetic. `react-plotly.js` drives the interactive vendor matrices.
* **Backend Architecture:** High-concurrency Python **FastAPI** backbone managing `pandas` contract dataframes.
* **AI / LLM Orchestration:** Powered by **LangChain** utilizing `ChatGroq` (Llama-3.3-70b-versatile) for blazing-fast inference, with automatic fallback handling to Google Gemini (`gemini-2.5-flash`).
* **Vector Retrieval:** HuggingFace Embeddings (`BAAI/bge-large-en-v1.5`) serving dense RAG capabilities.
* **Database:** Qdrant (Local Vector DB).

---

## ⚙️ How to Run Locally

### 1. Clone the Repository
```bash
git clone [https://github.com/Siddhesh1207/Lex-Sentinel.git](https://github.com/Siddhesh1207/Lex-Sentinel.git)
cd Lex-Sentinel
