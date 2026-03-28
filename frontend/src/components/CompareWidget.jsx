import { useState, useMemo } from 'react'
import { Send, CheckCircle2, Circle, Loader2, GitCompare } from 'lucide-react'
import { sendChatMessage } from '../services/api.js'

export default function CompareWidget({ heatmapData }) {
  const [selectedContracts, setSelectedContracts] = useState([])
  const [selectedClause, setSelectedClause] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  
  const contracts = heatmapData?.contracts || []
  const clauses = heatmapData?.clause_types || []

  const toggleContract = (c) => {
    if (selectedContracts.includes(c)) setSelectedContracts(selectedContracts.filter(x => x !== c))
    else if (selectedContracts.length < 3) setSelectedContracts([...selectedContracts, c])
  }

  const handleCompare = async () => {
    if (selectedContracts.length < 2 || !selectedClause) return
    setLoading(true)
    setResult(null)
    
    const prompt = `Can you provide a detailed side-by-side comparison of the "${selectedClause}" clause for these contracts: ${selectedContracts.join(', ')}? Present the output as a Markdown table highlighting the key differences and risk levels.`
    
    try {
      const res = await sendChatMessage(prompt, selectedContracts, [])
      setResult(res.answer)
    } catch (err) {
      setResult("Error generating comparison. " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#151822] border border-[#1F2433] p-6 rounded-2xl mt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
          <GitCompare className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-white tracking-wide">Clause Comparison Matrix</h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Select exactly 2 or 3 contracts and a clause to compare.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Selectors */}
        <div className="flex-1 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">1. Select Contracts (Max 3)</label>
            <div className="flex gap-2 flex-wrap max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
              {contracts.map(c => {
                const isSelected = selectedContracts.includes(c)
                const disabled = !isSelected && selectedContracts.length >= 3
                return (
                  <button
                    key={c}
                    disabled={disabled}
                    onClick={() => toggleContract(c)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border
                      ${isSelected 
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                        : disabled 
                          ? 'bg-[#1E2336]/50 border-transparent text-slate-600 cursor-not-allowed' 
                          : 'bg-[#1A1D27] border-[#1F2433] text-slate-400 hover:border-indigo-500/30 hover:text-slate-200'}`}
                  >
                    {isSelected ? <CheckCircle2 className="w-4 h-4 text-blue-400" /> : <Circle className="w-4 h-4 opacity-30" />}
                    <span className="truncate max-w-[150px]">{c}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
             <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">2. Select Clause</label>
             <select 
               value={selectedClause} 
               onChange={e => setSelectedClause(e.target.value)}
               className="w-full px-4 py-3 rounded-xl border border-[#1F2433] bg-[#0A0D14] text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors [&>option]:bg-[#0A0D14]"
             >
               <option value="" disabled>-- Select a clause --</option>
               {clauses.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>

          <button 
            onClick={handleCompare}
            disabled={selectedContracts.length < 2 || !selectedClause || loading}
            className="w-full flex justify-center items-center gap-2 py-3.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold shadow-md disabled:opacity-50 disabled:bg-[#1E2336] disabled:text-slate-500 disabled:cursor-not-allowed transition-all text-sm"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {loading ? 'Analyzing differences...' : 'Generate Matrix'}
          </button>
        </div>

        {/* Results */}
        <div className="flex-[2] bg-[#0A0D14] rounded-xl border border-[#1F2433] p-5 min-h-[300px]">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
               <div className="w-10 h-10 border-4 border-[#1E2336] border-t-indigo-500 rounded-full animate-spin" />
               <p className="animate-pulse text-sm font-semibold text-slate-400">Synthesizing semantic comparison across {selectedContracts.length} documents...</p>
             </div>
          ) : result ? (
             <div className="prose prose-invert prose-sm md:prose-base max-w-none 
              prose-th:bg-[#151822] prose-th:p-3 prose-th:rounded-t-lg prose-th:border-b-2 prose-th:border-indigo-500/30 prose-th:text-xs prose-th:tracking-widest prose-th:text-slate-400
              prose-td:p-3 prose-td:border-b prose-td:border-[#1F2433] prose-td:text-sm
              prose-table:border prose-table:border-[#1F2433] prose-table:rounded-xl">
               {/* Extremely simple markdown parser for the table/result from Groq/Gemini */}
               <div dangerouslySetInnerHTML={{ __html: result.replace(/\n/g, '<br/>').replace(/\|/g, '<span class="px-2 font-mono text-slate-600">|</span>') }} />
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
               <GitCompare className="w-12 h-12 opacity-20" />
               <p className="text-sm">Select contracts and a clause to view side-by-side comparative analysis.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
