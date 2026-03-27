import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Send, FileCode, CheckSquare, Square, Loader2, MessageCircle } from 'lucide-react';
import ChatBubble from '../components/ChatBubble';
import { fetchContracts, sendChatMessage } from '../services/api';
import toast from 'react-hot-toast';

const ChatInterface = () => {
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [selectedContracts, setSelectedContracts] = useState([]);
  const [filterQuery, setFilterQuery] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  const location = useLocation();

  useEffect(() => {
    const loadContracts = async () => {
      try {
        const data = await fetchContracts();
        setContracts(data);
        setFilteredContracts(data);
        
        // Handle URL params
        const params = new URLSearchParams(location.search);
        const preContract = params.get('contract');
        const preQuery = params.get('q');
        
        if (preContract && data.includes(preContract)) {
          setSelectedContracts([preContract]);
        }
        
        if (preQuery) {
          setInputValue(preQuery);
        }
        
      } catch (err) {
        toast.error("Failed to load contracts list");
      }
    };
    loadContracts();
  }, [location.search]);

  useEffect(() => {
    setFilteredContracts(
      contracts.filter(c => c.toLowerCase().includes(filterQuery.toLowerCase()))
    );
  }, [filterQuery, contracts]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleContractSelection = (contract) => {
    setSelectedContracts(prev => 
      prev.includes(contract) ? prev.filter(c => c !== contract) : [...prev, contract]
    );
  };

  const handleSend = async (overrideQuery = null) => {
    const queryToSend = overrideQuery || inputValue;
    if (!queryToSend.trim() || loading) return;

    const userMsg = { role: "user", content: queryToSend };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      // API expects max 10 messages for history
      const chatHistory = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      
      const res = await sendChatMessage(queryToSend, selectedContracts, chatHistory);
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.answer,
        sources: res.sources
      }]);
    } catch (err) {
      toast.error("Error communicating with AI");
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error while processing your request. Please ensure the backend and vector store are active."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    "What are the key risks in this contract?",
    "Does this contract have an Audit Rights clause?",
    "Compare termination clauses across selected contracts",
    "Show all missing critical clauses"
  ];

  return (
    <div className="flex h-full bg-white dark:bg-gray-900 overflow-hidden relative">
      <div className="w-[300px] border-r border-gray-200 dark:border-gray-800 flex flex-col h-full bg-gray-50/50 dark:bg-gray-800/20">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <FileCode size={20} className="text-blue-600 dark:text-blue-500" />
            <span>Select Contracts</span>
          </h2>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search contracts..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-shadow"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>
          <div className="flex justify-between items-center mt-4">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {selectedContracts.length} selected
            </span>
            <div className="space-x-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
              <button className="hover:underline" onClick={() => setSelectedContracts(contracts)}>All</button>
              <button className="hover:underline text-gray-500 dark:text-gray-400" onClick={() => setSelectedContracts([])}>Clear</button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
          {contracts.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-10">No contracts available</div>
          ) : (
            filteredContracts.map(c => {
              const selected = selectedContracts.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleContractSelection(c)}
                  className={`w-full flex items-center p-3 rounded-xl border text-left transition-all duration-200 ${
                    selected 
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 shadow-sm' 
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-gray-600'
                  }`}
                >
                  <div className={`mr-3 ${selected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {selected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <span className={`text-sm truncate w-full ${selected ? 'font-medium text-blue-900 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                    {c}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col h-full right-panel-bg">
        <div className="flex-1 overflow-y-auto p-6 md:p-10" id="chat-container">
          <div className="max-w-4xl mx-auto flex flex-col pt-10 pb-4">
            
            {messages.length === 0 ? (
              <div className="text-center my-auto flex flex-col items-center justify-center h-full space-y-8 animate-fade-in text-gray-400">
                <div className="bg-blue-50 dark:bg-gray-800 p-6 rounded-full border border-blue-100 dark:border-gray-700 mb-2">
                  <MessageCircle size={48} className="text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Contract Intelligence Chat</h2>
                <p className="max-w-md text-gray-500 dark:text-gray-400 leading-relaxed text-balance">
                  Ask me anything about your pharmaceutical specific contracts. I can find specific clauses, compare agreements, and perform deep risk analysis.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 w-full max-w-2xl text-left">
                  {quickActions.map((action, i) => (
                    <button 
                      key={i}
                      onClick={() => handleSend(action)}
                      className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:border-blue-300 dark:hover:border-gray-600 hover:shadow-sm transition font-medium"
                    >
                      {action} →
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 w-full animate-fade-in-up">
                {messages.map((m, i) => (
                  <ChatBubble key={i} role={m.role} content={m.content} sources={m.sources} />
                ))}
                
                {loading && (
                  <div className="flex justify-start w-full">
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 px-5 rounded-2xl rounded-tl-sm shadow-sm flex items-center space-x-3 text-gray-500">
                      <Loader2 className="animate-spin text-blue-500 mr-2" size={18} />
                      <span className="text-sm font-medium animate-pulse">Analyzing contracts...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
            
          </div>
        </div>
        
        <div className="p-5 md:px-10 pb-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-4xl mx-auto relative">
            <textarea
              className="w-full bg-white dark:bg-gray-800 p-4 pr-16 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-2xl shadow-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none outline-none transition-all duration-300 z-10 block"
              placeholder={selectedContracts.length ? `Ask about the ${selectedContracts.length} selected contracts...` : "Ask a question about any contract..."}
              rows={2}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button 
              onClick={() => handleSend()}
              disabled={loading || !inputValue.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-95"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 mx-auto max-w-xl">
            AI can make mistakes. Always verify the source citations. Queries without specific contract selections will search the entire available database (Top 8 semantic matches).
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
