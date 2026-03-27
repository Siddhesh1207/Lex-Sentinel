import React, { useState } from 'react';

const CitationBadge = ({ source }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div 
      className="relative inline-block mr-2 mt-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button className="flex items-center text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/60 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/50 transition">
        <span className="truncate max-w-[150px]">{source.contract_name}</span>
        {source.page_hint !== "N/A" && (
          <span className="ml-1 opacity-75">, {source.page_hint}</span>
        )}
      </button>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-64 bg-gray-900 text-white dark:bg-gray-800 dark:border dark:border-gray-700 text-xs rounded p-3 shadow-lg">
          <p className="font-semibold mb-1 border-b border-gray-700 pb-1">{source.contract_name}</p>
          <p className="line-clamp-6 text-gray-300">"{source.excerpt}"</p>
          <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45 border-r border-b border-transparent dark:border-gray-700"></div>
        </div>
      )}
    </div>
  );
};

export default CitationBadge;
