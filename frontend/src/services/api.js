import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

// Response interceptor to handle errors gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error);
    const message = error.response?.data?.detail || error.message || "An expected error occurred";
    throw new Error(message);
  }
);

export const fetchHealth = async () => {
  const res = await api.get('/api/health');
  return res.data;
};

export const fetchMetrics = async () => {
  const res = await api.get('/api/dashboard/metrics');
  return res.data;
};

export const fetchHeatmap = async () => {
  const res = await api.get('/api/dashboard/heatmap');
  return res.data;
};

export const fetchClauseDetail = async (contractName, clauseType) => {
  const cn = encodeURIComponent(contractName);
  const ct = encodeURIComponent(clauseType);
  const res = await api.get(`/api/contract/${cn}/clause/${ct}`);
  return res.data;
};

export const fetchContracts = async () => {
  const res = await api.get('/api/contracts');
  return res.data;
};

export const sendChatMessage = async (query, contractFilters = [], chatHistory = []) => {
  const res = await api.post('/api/chat', {
    query,
    contract_filters: contractFilters,
    chat_history: chatHistory
  });
  return res.data;
};

export const fetchEvaluation = async () => {
  const res = await api.get('/api/evaluation');
  return res.data;
};
