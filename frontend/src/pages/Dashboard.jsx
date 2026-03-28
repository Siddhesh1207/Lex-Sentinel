import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Plot from 'react-plotly.js'
import toast from 'react-hot-toast'
import { AlertCircle, RefreshCw, FileText, TrendingUp, AlertTriangle, BarChart2, Upload, Loader2 } from 'lucide-react'
import MetricCard from '../components/MetricCard.jsx'
import ClauseDrawer from '../components/ClauseDrawer.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import CompareWidget from '../components/CompareWidget.jsx'
import { fetchMetrics, fetchHeatmap, fetchClauseDetail, uploadContract, sendChatMessage } from '../services/api.js'

const RISK_OPTIONS = [
  { value: 'all', label: 'All Contracts' },
  { value: 'high', label: 'High Risk (≥15)' },
  { value: 'medium', label: 'Medium Risk (8–14)' },
  { value: 'low', label: 'Low Risk (<8)' },
]

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null)
  const [heatmapData, setHeatmapData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Dynamic Chart State
  const [stagedContracts, setStagedContracts] = useState([])
  const [searchContract, setSearchContract] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [filterRisk, setFilterRisk] = useState('all')
  
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [clauseDetail, setClauseDetail] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)

  // New State and Ref for File Upload
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  const loadData = async () => {
    try {
      const [m, h] = await Promise.all([fetchMetrics(), fetchHeatmap()])
      setMetrics(m)
      setHeatmapData(h)
    } catch (e) {
      setError(e.message)
      toast.error('Failed to load dashboard data')
    }
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  // Auto-initialize first contract when heatmapData loads
  useEffect(() => {
    if (heatmapData && heatmapData.contracts.length > 0 && stagedContracts.length === 0) {
      setStagedContracts([heatmapData.contracts[0]])
    }
  }, [heatmapData])

  // File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const toastId = toast.loading(`Analyzing ${file.name}... this takes ~60 seconds.`)

    try {
      await uploadContract(file)
      toast.success('Analysis complete!', { id: toastId })
      await loadData()
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`, { id: toastId })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = '' // Reset input
    }
  }

  // AI Action Center logic
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  
  useEffect(() => {
    if (heatmapData && heatmapData.contracts.length > 0) {
      setAiLoading(true)
      const prompt = `Based on these metrics: ${metrics?.high_risk_count} high risk contracts out of ${metrics?.total_contracts}. Give me exactly ONE short sentence (under 15 words) summarizing the risk landscape. Be direct.`
      sendChatMessage(prompt, [], [])
        .then(res => setAiSummary(res.answer))
        .catch(err => setAiSummary('AI could not generate a summary at this time.'))
        .finally(() => setAiLoading(false))
    }
  }, [heatmapData, metrics])

  // Filter visible contracts based on staged list and risk selection
  const visibleContracts = useMemo(() => {
    if (!heatmapData || stagedContracts.length === 0) return []
    return stagedContracts.filter((name) => {
      if (filterRisk !== 'all') {
        const score = heatmapData.risk_scores[name] ?? 0
        if (filterRisk === 'high' && score < 15) return false
        if (filterRisk === 'medium' && (score < 8 || score >= 15)) return false
        if (filterRisk === 'low' && score >= 8) return false
      }
      return true
    })
  }, [heatmapData, filterRisk, stagedContracts])

  // Search Results computed dynamically
  const availableToStage = useMemo(() => {
    if (!heatmapData) return []
    return heatmapData.contracts.filter(c => !stagedContracts.includes(c))
  }, [heatmapData, stagedContracts])

  const searchResults = useMemo(() => {
    if (!searchContract.trim()) return availableToStage.slice(0, 5) // Show top 5 default
    return availableToStage.filter(c => c.toLowerCase().includes(searchContract.toLowerCase())).slice(0, 8)
  }, [availableToStage, searchContract])

  const addContract = (name) => {
    setStagedContracts(prev => [...prev, name])
    setSearchContract('')
    setIsSearchFocused(false)
  }

  const removeContract = (name) => {
    setStagedContracts(prev => prev.filter(c => c !== name))
  }

  const { zMatrix, textMatrix } = useMemo(() => {
    if (!heatmapData || !visibleContracts.length)
      return { zMatrix: [], textMatrix: [] }
    const indexMap = Object.fromEntries(
      heatmapData.contracts.map((name, i) => [name, i])
    )
    const z = visibleContracts.map((name) => {
      const row = heatmapData.matrix[indexMap[name]] ?? []
      return row.map((v) => (v === 'PRESENT' ? 1 : 0))
    })
    const t = visibleContracts.map((name) => {
      return heatmapData.matrix[indexMap[name]] ?? []
    })
    return { zMatrix: z, textMatrix: t }
  }, [heatmapData, visibleContracts])

  const handleCellClick = useCallback(
    async (data) => {
      if (!data.points?.length) return
      const point = data.points[0]
      const contractName = point.y
      const clauseType = point.x
      setDrawerOpen(true)
      setDrawerLoading(true)
      setClauseDetail(null)
      try {
        const detail = await fetchClauseDetail(contractName, clauseType)
        setClauseDetail(detail)
      } catch (e) {
        toast.error(`Could not load clause detail: ${e.message}`)
        setDrawerOpen(false)
      } finally {
        setDrawerLoading(false)
      }
    },
    []
  )

  const plotHeight = Math.max(300, Math.min(visibleContracts.length * 28 + 180, 800))

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-gray-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading contract risk analysis…</p>
        <p className="text-xs text-gray-300 dark:text-gray-600">This may take a moment</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-8">
        <div className="max-w-lg w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-red-700 dark:text-red-400 mb-2">
            Pipeline Not Ready
          </h2>
          <p className="text-sm text-red-600 dark:text-red-500 mb-4">{error}</p>
          <code className="block text-xs bg-red-100 dark:bg-red-900/40 rounded-lg px-3 py-2 font-mono text-red-800 dark:text-red-300">
            python run_pipeline.py --mode full --contracts 20
          </code>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen max-w-[1600px] mx-auto space-y-8">
      
      {/* Page Header AI Widget & Upload */}
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
        
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Clinical Vendor Risk
          </h1>
          <p className="text-[13px] text-slate-400 font-medium">
            Contract intelligence for pharmaceutical vendor management.
          </p>
        </div>

        <div className="flex-1 w-full lg:max-w-xl glass-card relative p-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <div className="relative p-4 flex gap-4 items-center">
            <div className="w-10 h-10 rounded-lg bg-[#1E2336] flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-400 font-bold text-lg leading-none">AI</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                Lex-Sentinel Overview <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </h4>
              <p className="text-[13px] text-slate-200 font-medium truncate">
                {aiLoading ? (
                  <span className="animate-pulse text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Processing telemetry...</span>
                ) : (
                  aiSummary || 'Real-time intelligence and risk profiling for enterprise contract lifecycles.'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center self-start">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.pdf"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold text-white shadow-md transition-all ml-4
              ${isUploading
                ? 'bg-[#1E2336] cursor-not-allowed text-slate-400'
                : 'bg-indigo-500 hover:bg-indigo-400 active:scale-95'
              }`}
          >
            {isUploading ? (
              <Loader2 className="w-[18px] h-[18px] animate-spin" />
            ) : (
              <Upload className="w-[18px] h-[18px]" />
            )}
            {isUploading ? 'Extracting...' : 'Upload Contract'}
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Contracts Analysed"
          value={metrics?.total_contracts}
          sublabel="Active in pipeline"
          color="blue"
          icon={FileText}
        />
        <MetricCard
          label="High-Risk Contracts"
          value={metrics?.high_risk_count}
          sublabel="Score ≥ 15"
          color="red"
          icon={AlertTriangle}
        />
        <MetricCard
          label="Avg Clauses Present"
          value={metrics?.avg_clauses_present}
          sublabel="Per contract"
          color="amber"
          icon={TrendingUp}
        />
        <MetricCard
          label="System F1 Score"
          value={
            metrics?.overall_f1 != null
              ? `${(metrics.overall_f1 * 100).toFixed(1)}%`
              : 'N/A'
          }
          sublabel="vs CUAD ground truth"
          color="green"
          icon={BarChart2}
        />
      </div>

      {/* Control Bar: Staging & Filtering */}
      <div className="bg-[#151822] rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border border-[#1F2433] p-4 shadow-xl mb-4 relative z-20">
        
        {/* Dynamic Search & Add Component */}
        <div className="relative w-full md:w-80 group">
          <div className="flex items-center bg-[#0B0E14] border border-[#1F2433] group-focus-within:border-indigo-500/50 rounded-xl px-3 py-2 transition-colors">
            <AlertCircle className="w-4 h-4 text-slate-500 mr-2" />
            <input 
              type="text" 
              placeholder="Search to add to matrix..." 
              value={searchContract}
              onChange={(e) => setSearchContract(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="bg-transparent text-[13px] font-semibold text-white w-full border-none focus:outline-none focus:ring-0 placeholder:text-slate-600"
            />
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-full bg-[#151822] border border-[#1F2433] rounded-xl shadow-2xl overflow-hidden py-1 z-50">
              {searchResults.map(c => (
                <div key={c} className="flex items-center justify-between px-3 py-2 hover:bg-[#1E2336] transition-colors group/item">
                  <span className="text-[12px] font-bold text-slate-300 truncate max-w-[80%]">{c}</span>
                  <button 
                    onClick={() => addContract(c)}
                    className="p-1 rounded bg-indigo-500/20 text-indigo-400 opacity-0 group-hover/item:opacity-100 hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                    title="Add to Matrix"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {stagedContracts.length > 1 && (
             <button
               onClick={() => setStagedContracts([])}
               className="text-[11px] font-bold uppercase tracking-widest px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
             >
               Clear Chart
             </button>
          )}

          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="px-4 py-2 text-[13px] font-semibold rounded-xl border border-[#1F2433] bg-[#0A0D14] text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors [&>option]:bg-[#0B0E14]"
          >
            {RISK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="px-3 text-[11px] font-bold tracking-widest text-slate-500 bg-[#0B0E14] border border-[#1F2433] py-2.5 rounded-xl uppercase shadow-inner">
            {visibleContracts.length} Visible
          </span>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-[#151822] border border-[#1F2433] rounded-2xl overflow-hidden p-2 relative z-10 shadow-2xl">
        {visibleContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
             <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
             <p className="text-sm font-bold text-slate-400">The matrix is empty.</p>
             <p className="text-[11px] font-semibold text-slate-500 border border-[#1F2433] bg-[#0A0D14] px-4 py-2 rounded-lg mt-1">Search and click the + button to add a contract to the view.</p>
          </div>
        ) : (
          <Plot
            data={[
              {
                type: 'heatmap',
                z: zMatrix,
                x: heatmapData?.clause_types ?? [],
                y: visibleContracts,
                text: textMatrix,
                colorscale: [[0, '#f43f5e'], [1, '#10b981']], // Rose & Emerald
                zmin: 0,
                zmax: 1,
                zsmooth: false,
                showscale: false,
                hovertemplate: '<div class="px-3 py-2 bg-[#151822] rounded-xl shadow-xl border border-[#1F2433] text-white"><b>%{y}</b><br><span class="text-xs text-slate-400 uppercase tracking-widest font-bold block mt-1">%{x}</span> <b class="text-indigo-400">%{text}</b></div><extra></extra>',
                xgap: 4,
                ygap: 4,
              },
            ]}
            layout={{
              height: plotHeight,
              margin: { l: 210, r: 20, t: 20, b: 140 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              xaxis: {
                tickangle: -45,
                tickfont: { size: 10, color: '#94a3b8', family: 'Inter' },
                fixedrange: false,
                showgrid: false,
                zeroline: false,
              },
              yaxis: {
                tickfont: { size: 11, color: '#e2e8f0', family: 'Inter' },
                automargin: true,
                fixedrange: false,
                showgrid: false,
                zeroline: false,
              },
            }}
            config={{ responsive: true, displayModeBar: true, scrollZoom: true }}
            style={{ width: '100%' }}
            onClick={handleCellClick}
          />
        )}
      </div>

      {/* Dynamic Staged Contract Chips (Allows users to remove specific ones) */}
      {stagedContracts.length > 0 && (
         <div className="flex flex-wrap gap-2 px-1">
           {stagedContracts.map(c => (
             <div key={c} className="flex items-center gap-2 bg-[#151822] border border-[#1F2433] rounded-full px-3 py-1 shadow-md">
               <span className="text-[11px] font-bold text-slate-300 truncate max-w-[150px]">{c}</span>
               <button onClick={() => removeContract(c)} className="text-slate-500 hover:text-rose-400 transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
               </button>
             </div>
           ))}
         </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 px-4 pb-8">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-[4px] bg-emerald-500/20 border border-emerald-500/50 inline-block" />
          <span className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase">Clause Present</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-[4px] bg-rose-500/20 border border-rose-500/50 inline-block" />
          <span className="text-[11px] font-bold text-rose-400 tracking-wider uppercase">Clause Absent (Risk)</span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium ml-auto">
          Hover to view · Click to inspect clause detail
        </span>
      </div>

      {/* Clause Comparison Widget */}
      <CompareWidget heatmapData={heatmapData} />

      {/* Clause Drawer */}
      <ClauseDrawer
        isOpen={drawerOpen}
        clauseData={clauseDetail}
        loading={drawerLoading}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}