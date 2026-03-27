import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';
import RiskBadge from './RiskBadge';

const ClauseDrawer = ({ isOpen, clauseData, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen || !clauseData) return null;

  const isPresent = clauseData.status === "PRESENT";
  
  const handleAskAI = () => {
    // Basic navigation, advanced app would manage context state
    navigate(`/chat?contract=${encodeURIComponent(clauseData.contract_name)}&q=Tell me about the ${encodeURIComponent(clauseData.clause_type)} clause`);
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-gray-900/50 dark:bg-black/60 z-40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className={`fixed right-0 top-0 h-full w-[450px] bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1 pr-4" title={clauseData.contract_name}>
              {clauseData.contract_name}
            </h2>
            <div className="flex items-center space-x-3 mt-1.5">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {clauseData.clause_type}
              </span>
              <RiskBadge score={clauseData.risk_weight} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <span className={`px-4 py-1.5 rounded-md text-sm font-bold tracking-wider ${
              isPresent 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' 
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
            }`}>
              {clauseData.status}
            </span>
            
            <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span>Confidence:</span>
              <span className={`w-2 h-2 rounded-full ${
                clauseData.confidence === 'HIGH' ? 'bg-green-500' :
                clauseData.confidence === 'MEDIUM' ? 'bg-amber-500' : 'bg-red-500'
              }`}></span>
              <span>{clauseData.confidence}</span>
            </div>
          </div>

          {isPresent ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-2">Excerpt from text</h3>
              <div className="bg-blue-50/50 dark:bg-gray-900/50 border border-blue-100 dark:border-gray-700 p-5 rounded-xl rounded-tl-none relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l"></div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-serif italic text-sm">
                  "{clauseData.excerpt}"
                </p>
              </div>
              <p className="text-xs text-right text-gray-500 font-medium">
                Page Hint: {clauseData.page_hint !== "N/A" ? clauseData.page_hint : "Unknown section"}
              </p>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-5 mt-4">
              <div className="flex items-start">
                <AlertTriangle className="text-red-500 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" size={18} />
                <div>
                  <h4 className="text-red-800 dark:text-red-300 font-semibold mb-1">Clause Missing</h4>
                  <p className="text-red-700/80 dark:text-red-400/80 text-sm leading-relaxed">
                    This clause is NOT found in the contract. This significantly increases legal and financial exposure.
                  </p>
                  <div className="mt-3 font-mono text-xs text-red-600 dark:text-red-400 bg-white/50 dark:bg-black/20 inline-block px-2 py-1 rounded">
                    Risk Weight Penalty: +{clauseData.risk_weight}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
          <button 
            onClick={handleAskAI}
            className="flex items-center space-x-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 font-medium transition shadow-sm"
          >
            <span>Ask AI about this clause</span>
            <ExternalLink size={16} />
          </button>
        </div>
      </div>
    </>
  );
};

export default ClauseDrawer;
