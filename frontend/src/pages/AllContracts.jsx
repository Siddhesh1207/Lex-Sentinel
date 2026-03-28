import { useState, useEffect } from 'react'
import { FileText, Loader2, ArrowRight } from 'lucide-react'
import { fetchContracts } from '../services/api.js'
import { useNavigate } from 'react-router-dom'

export default function AllContracts() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchContracts()
      .then(setContracts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 pb-32 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Contract Repository</h1>
        <p className="text-slate-400 font-medium">Manage and review all processed documents within the enterprise vault.</p>
      </div>

      <div className="bg-[#151822] border border-[#1F2433] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-indigo-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-semibold">Syncing vault...</p>
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
            <FileText className="w-12 h-12 opacity-50" />
            <p className="text-sm font-semibold">No contracts processed yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1F2433]">
            {contracts.map((c) => (
              <div key={c} className="flex items-center justify-between p-5 hover:bg-[#1A1D27] transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-white group-hover:text-indigo-300 transition-colors">{c}</h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Processed & Verified</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/chat', { state: { prefillContract: c }})}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E2336] hover:bg-indigo-500 hover:text-white text-slate-400 text-xs font-bold transition-all opacity-0 group-hover:opacity-100"
                >
                  Analyze <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
