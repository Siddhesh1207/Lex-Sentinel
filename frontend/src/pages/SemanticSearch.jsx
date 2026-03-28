import { useState } from 'react'
import { Sparkles, Search, ArrowRight, Loader2, Filter } from 'lucide-react'
import { semanticSearch } from '../services/api.js'
import { useNavigate } from 'react-router-dom'

export default function SemanticSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim() || loading) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const data = await semanticSearch(query)
      if (data.error) setError(data.error)
      else setResults(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const SUGGESTIONS = [
    "Contracts where Cap on Liability is missing",
    "Show me non-disclosure agreements with missing IP Ownership",
    "Agreements without an Audit Rights provision",
  ]

  return (
    <div className="p-8 pb-32 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-12 text-center mt-10">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-6 border border-indigo-500/20 shadow-xl shadow-indigo-500/10">
          <Sparkles className="w-7 h-7 text-indigo-400" />
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-4">Semantic Discovery</h1>
        <p className="text-sm font-semibold text-slate-400 max-w-lg mx-auto leading-relaxed">
          Filter the enterprise vault using natural language. We'll automatically identify the necessary clause conditions and cross-reference your repository.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-12">
        <div className="relative group">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl transition-all group-focus-within:bg-indigo-500/40 opacity-50" />
          <div className="relative bg-[#151822] border border-[#1F2433] rounded-2xl shadow-2xl p-2 flex items-center gap-3 w-full group-focus-within:border-indigo-500/50 transition-colors">
            <Search className="w-6 h-6 ml-3 text-indigo-400" />
            <input 
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="E.g. contracts missing termination for convenience..."
              className="flex-1 bg-transparent border-none text-[15px] font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 py-3"
            />
            <button 
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-3 font-bold text-sm tracking-wide disabled:opacity-50 transition-colors shadow-lg flex flex-shrink-0 items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Discover'}
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {!results && !loading && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2">Try:</span>
            {SUGGESTIONS.map(s => (
              <button 
                key={s} 
                onClick={() => setQuery(s)}
                type="button"
                className="px-3 py-1.5 rounded-lg bg-[#151822] border border-[#1F2433] text-xs font-semibold text-slate-400 hover:text-indigo-300 hover:border-indigo-500/50 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-semibold mb-8 text-center">
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-[#151822] border border-[#1F2433] rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-[#1A1D27] border-b border-[#1F2433] px-6 py-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" /> Extracted Constraints
            </h3>
            <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-400 text-[10px] font-bold tracking-widest uppercase">
              {results.matching_contracts.length} Results
            </span>
          </div>
          
          <div className="p-6 border-b border-[#1F2433]">
             {Object.keys(results.filters_applied || {}).length === 0 ? (
               <p className="text-sm font-semibold text-slate-500 mb-2">No specific clause constraints detected by NLP model.</p>
             ) : (
               <div className="flex flex-wrap gap-3">
                 {Object.entries(results.filters_applied).map(([clause, status]) => (
                   <span key={clause} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-[#1F2433] text-xs font-bold text-slate-300 shadow-inner">
                     {clause}: <span className={status.toUpperCase() === 'PRESENT' ? 'text-emerald-400' : 'text-rose-400'}>{status.toUpperCase()}</span>
                   </span>
                 ))}
               </div>
             )}
          </div>

          <div className="divide-y divide-[#1F2433]">
             {results.matching_contracts.length === 0 ? (
               <div className="p-8 text-center text-sm font-semibold text-slate-500">
                 No contracts match these specific criteria.
               </div>
             ) : (
               results.matching_contracts.map(c => (
                 <div key={c} className="flex items-center justify-between p-6 hover:bg-[#1A1D27] transition-colors group">
                   <div>
                     <h3 className="text-[15px] font-bold text-white tracking-wide">{c}</h3>
                   </div>
                   <button 
                     onClick={() => navigate('/chat', { state: { prefillContract: c }})}
                     className="flex items-center gap-2 text-xs font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors"
                   >
                     Launch Review <ArrowRight className="w-4 h-4" />
                   </button>
                 </div>
               ))
             )}
          </div>
        </div>
      )}
    </div>
  )
}
