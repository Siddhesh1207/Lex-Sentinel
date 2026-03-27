import React from 'react';

const RiskBadge = ({ score }) => {
  let badgeClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  let text = "LOW RISK";

  if (score >= 15) {
    badgeClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    text = "HIGH RISK";
  } else if (score >= 8) {
    badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    text = "MEDIUM RISK";
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
      {text}
    </span>
  );
};

export default RiskBadge;
