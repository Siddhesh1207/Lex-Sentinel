const API_BASE = 'http://localhost:8000/api'

export async function fetchMetrics() {
  const res = await fetch(`${API_BASE}/dashboard/metrics`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchHeatmap() {
  const res = await fetch(`${API_BASE}/dashboard/heatmap`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchClauseDetail(contractName, clauseType) {
  const res = await fetch(`${API_BASE}/contract/${encodeURIComponent(contractName)}/clause/${encodeURIComponent(clauseType)}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchContracts() {
  const res = await fetch(`${API_BASE}/contracts`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function sendChatMessage(query, contractFilters, chatHistory) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      contract_filters: contractFilters,
      chat_history: chatHistory,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchEvaluation() {
  const res = await fetch(`${API_BASE}/evaluation`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function uploadContract(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText || 'Upload failed')
  }
  return res.json()
}

export async function draftClause(clauseType) {
  const res = await fetch(`${API_BASE}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clause_type: clauseType }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function redlineClause(excerpt) {
  const res = await fetch(`${API_BASE}/redline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ excerpt }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function semanticSearch(query) {
  const res = await fetch(`${API_BASE}/search/semantic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}