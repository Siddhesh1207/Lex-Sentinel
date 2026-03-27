import React from 'react';

const MetricCard = ({ label, value, sublabel, color = "blue" }) => {
  const borderColors = {
    blue: "border-l-blue-500",
    red: "border-l-red-500",
    green: "border-l-green-500",
    amber: "border-l-amber-500"
  };

  return (
    <div className={`bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm border-l-4 ${borderColors[color]}`}>
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sublabel && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">{sublabel}</div>
      )}
    </div>
  );
};

export default MetricCard;
