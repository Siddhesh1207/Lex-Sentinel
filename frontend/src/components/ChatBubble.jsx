import React from 'react';
import CitationBadge from './CitationBadge';
import { User, Bot } from 'lucide-react';

const ChatBubble = ({ role, content, sources }) => {
  const isUser = role === "user";

  // Simple markdown-like processing for bold text and newlines
  const renderContent = (text) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-3 mt-1 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <Bot size={18} />
          </div>
        </div>
      )}
      
      <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
        isUser 
          ? 'bg-blue-600 text-white rounded-tr-sm' 
          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 shadow-sm rounded-tl-sm'
      }`}>
        <div className="text-sm space-y-2 whitespace-pre-wrap leading-relaxed">
          {renderContent(content)}
        </div>
        
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Sources cited:</p>
            <div className="flex flex-wrap">
              {sources.map((src, i) => (
                <CitationBadge key={i} source={src} />
              ))}
            </div>
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="ml-3 mt-1 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center">
            <User size={18} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBubble;
