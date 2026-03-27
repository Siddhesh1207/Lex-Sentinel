import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageCircle, BarChart2, Moon, Sun } from 'lucide-react';

const Sidebar = ({ darkMode, setDarkMode }) => {
  return (
    <div className="w-[220px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full transition-colors duration-200">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Clinical-Legal Sentinel</h1>
        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">Powered by AI</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <NavLink to="/" end className={({ isActive }) => 
          `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 dark:bg-blue-900/40 dark:text-blue-300' 
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 border-l-4 border-transparent'
          }`
        }>
          <LayoutDashboard size={18} />
          <span>Risk Dashboard</span>
        </NavLink>
        
        <NavLink to="/chat" className={({ isActive }) => 
          `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 dark:bg-blue-900/40 dark:text-blue-300' 
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 border-l-4 border-transparent'
          }`
        }>
          <MessageCircle size={18} />
          <span>Contract Chat</span>
        </NavLink>
        
        <NavLink to="/evaluation" className={({ isActive }) => 
          `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 dark:bg-blue-900/40 dark:text-blue-300' 
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 border-l-4 border-transparent'
          }`
        }>
          <BarChart2 size={18} />
          <span>Evaluation</span>
        </NavLink>
      </nav>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center w-full space-x-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <div className="mt-4 px-3 text-xs text-gray-400 dark:text-gray-500">
          i2e Clinical Intelligence<br />v1.0.0
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
