import React, { useState, useEffect } from 'react';
import Plotly from 'react-plotly.js';
import { fetchMetrics, fetchHeatmap, fetchClauseDetail } from '../services/api';
import MetricCard from '../components/MetricCard';
import ClauseDrawer from '../components/ClauseDrawer';
import { Loader2, Search, Filter, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [clauseDetail, setClauseDetail] = useState(null);
  
  const [filterRisk, setFilterRisk] = useState("all");
  const [searchContract, setSearchContract] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [metRes, hmRes] = await Promise.all([
          fetchMetrics(),
          fetchHeatmap()
        ]);
        setMetrics(metRes);
        setHeatmapData(hmRes);
        setError(false);
      } catch (err) {
        console.error("Dashboard error:", err);
        setError(true);
        toast.error("Pipeline not ready or backend offline.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCellClick = async (data) => {
    if (!data.points || data.points.length === 0) return;
    const pt = data.points[0];
    const contractName = pt.y;
    const clauseType = pt.x;
    
    // In React Plotly, sometimes short strings are appended with dots. The API expects the exact name.
    // Assuming backend provided correct x-axis labels in HeatmapData.clause_types
    // Wait, the prompt says abbreviate x: clause_types to 12 chars.
    // Actually, to make it easier to map back, we should just use the original labels or map them.
    // If the frontend modifies x labels, we need to map pt.pointIndex to clause_types.
    
    const trueClauseType = heatmapData.clause_types[pt.x]; // if x is index
    const actClause = typeof pt.x === 'string' ? pt.x : trueClauseType;

    try {
      const detail = await fetchClauseDetail(contractName, actClause);
      setClauseDetail(detail);
      setDrawerOpen(true);
    } catch (err) {
      toast.error("Could not fetch clause details");
    }
  };

  const handleExportCSV = () => {
    if (!heatmapData) return;
    const { contracts, clause_types, matrix } = heatmapData;
    let csv = "Contract," + clause_types.join(",") + "\n";
    for (let i = 0; i < contracts.length; i++) {
      let row = [contracts[i]];
      for (let j = 0; j < clause_types.length; j++) {
        row.push(matrix[i][j] === 1 ? "PRESENT" : "ABSENT");
      }
      csv += row.join(",") + "\n";
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'risk_matrix.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-blue-600">
        <Loader2 className="animate-spin mb-4" size={48} />
        <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading contract risk analysis...</h2>
      </div>
    );
  }

  if (error || !heatmapData) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-bold mb-2">Pipeline Not Ready</h2>
          <p>The backend pipeline has not completed or the server is unavailable.</p>
          <div className="mt-4 p-4 bg-gray-900 text-green-400 font-mono text-sm rounded">
            python run_pipeline.py --mode full --contracts 20
          </div>
        </div>
      </div>
    );
  }

  // Filter logic
  let filteredContracts = [];
  let filteredMatrix = [];
  
  for (let i = 0; i < heatmapData.contracts.length; i++) {
    const c = heatmapData.contracts[i];
    const score = heatmapData.risk_scores[c] || 0;
    
    // search filter
    if (searchContract && !c.toLowerCase().includes(searchContract.toLowerCase())) continue;
    
    // risk filter
    if (filterRisk === "high" && score < 15) continue;
    if (filterRisk === "medium" && (score < 8 || score >= 15)) continue;
    if (filterRisk === "low" && score >= 8) continue;
    
    filteredContracts.push(c);
    filteredMatrix.push(heatmapData.matrix[i]);
  }

  // Chart config
  const height = Math.max(800, filteredContracts.length * 18 + 150);
  // We want contracts on Y axis. Plotly heatmap convention: z is array of arrays [y][x]
  
  return (
    <div className="p-8 pb-32 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white capitalize tracking-tight">Clinical Vendor & CRO Risk Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Contract intelligence for pharmaceutical vendor management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard label="Contracts Analyzed" value={metrics?.total_contracts || 0} color="blue" />
        <MetricCard label="High-Risk Contracts" value={metrics?.high_risk_count || 0} color="red" />
        <MetricCard label="Avg Clauses Present" value={metrics?.avg_clauses_present || "0 / 41"} color="amber" />
        <MetricCard label="System F1 Score" value={metrics?.overall_f1 || "--"} color="green" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/80">
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search contracts..."
                className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 w-64"
                value={searchContract}
                onChange={(e) => setSearchContract(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select 
                className="pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none focus:ring-2 focus:ring-blue-500"
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
              >
                <option value="all">All Risk Levels</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>
            </div>
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="w-full overflow-x-auto relative">
          <Plotly
            data={[{
              z: filteredMatrix,
              x: heatmapData.clause_types,
              y: filteredContracts,
              type: 'heatmap',
              zsmooth: false,
              colorscale: [[0, "#ef4444"], [1, "#22c55e"]], // 0 = ABSENT (Red), 1 = PRESENT (Green)
              showscale: false,
              hoverongaps: false,
              hovertemplate: "%{y} — %{x}: %{text}<extra></extra>",
              text: filteredMatrix.map(row => row.map(v => v === 1 ? "PRESENT" : "ABSENT"))
            }]}
            layout={{
              height: height,
              autosize: true,
              margin: { l: 240, r: 20, t: 150, b: 20 },
              xaxis: { 
                side: 'top', 
                tickangle: -45, 
                tickfont: { size: 10, color: document.documentElement.classList.contains('dark') ? '#aaa' : '#555' } 
              },
              yaxis: { 
                tickfont: { size: 11, color: document.documentElement.classList.contains('dark') ? '#ddd' : '#333' } 
              },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
            }}
            config={{ responsive: true, displayModeBar: false }}
            onClick={handleCellClick}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <ClauseDrawer 
        isOpen={drawerOpen} 
        clauseData={clauseDetail} 
        onClose={() => setDrawerOpen(false)} 
      />
    </div>
  );
};

export default Dashboard;
