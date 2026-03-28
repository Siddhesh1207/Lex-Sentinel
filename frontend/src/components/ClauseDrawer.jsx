import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, AlertTriangle, CheckCircle, ExternalLink, Info, PenTool, Highlighter, Loader2 } from 'lucide-react'
import RiskBadge from './RiskBadge.jsx'
import { draftClause, redlineClause } from '../services/api.js'

const CRITICAL = [
  'Cap on Liability', 'Audit Rights', 'Termination for Convenience',
  'Change of Control', 'IP Ownership Assignment', 'Anti-Assignment',
  'Insurance', 'Uncapped Liability',
]

const CONFIDENCE_DOT = {
  HIGH: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-rose-500',
}

export default function ClauseDrawer({ isOpen, clauseData, onClose, loading }) {
  const navigate = useNavigate()
  const isPresent = clauseData?.status === 'PRESENT'
  const riskWeight = clauseData?.risk_weight ?? (CRITICAL.includes(clauseData?.clause_type) ? 3 : 1)
  const mockScore = !isPresent ? (riskWeight === 3 ? 18 : 5) : 2

  const [isDrafting, setIsDrafting] = useState(false)
  const [draftResult, setDraftResult] = useState(null)
  const [isRedlining, setIsRedlining] = useState(false)
  const [redlineResult, setRedlineResult] = useState(null)

  useEffect(() => {
    setDraftResult(null)
    setRedlineResult(null)
  }, [clauseData])

  function handleAskAI() {
    navigate('/chat', {
      state: {
        prefillContract: clauseData?.contract_name,
        prefillQuery: `Does this contract have a ${clauseData?.clause_type} clause? Explain in detail.`,
      },
    })
    onClose()
  }

  async function handleDraft() {
    if (!clauseData) return
    setIsDrafting(true)
    try {
      const res = await draftClause(clauseData.clause_type)
      setDraftResult(res.draft)
    } catch (e) {
      setDraftResult('Failed to generate draft. ' + e.message)
    } finally {
      setIsDrafting(false)
    }
  }

  async function handleRedline() {
    if (!clauseData?.excerpt) return
    setIsRedlining(true)
    try {
      const res = await redlineClause(clauseData.excerpt)
      setRedlineResult(res.redlined_text)
    } catch (e) {
      setRedlineResult(clauseData.excerpt) // Fallback
    } finally {
      setIsRedlining(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-[#0B0E14]/70 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-screen w-[480px] z-50 bg-[#151822]
          border-l border-[#1F2433] shadow-2xl
          transition-transform duration-300 ease-in-out flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F2433] bg-[#0B0E14]">
          <p className="text-[13px] font-bold tracking-widest text-slate-400 uppercase">Clause Detail</p>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#1E2336] text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-semibold">Loading clause detail…</p>
            </div>
          )}

          {!loading && !clauseData && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
              <Info className="w-10 h-10" />
              <p className="text-sm font-semibold">Click a cell in the heatmap to see clause details.</p>
            </div>
          )}

          {!loading && clauseData && (
            <div className="space-y-6">
              {/* Contract name */}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Contract
                </p>
                <p className="text-[15px] font-bold text-white leading-snug break-words">
                  {clauseData.contract_name}
                </p>
              </div>

              {/* Clause type + risk badge */}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Clause Type
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-[15px] font-bold text-white">
                    {clauseData.clause_type}
                  </p>
                  <RiskBadge score={mockScore} />
                </div>
              </div>

              {/* Status */}
              <div className={`rounded-xl p-4 flex items-center gap-3 border ${isPresent
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-rose-500/10 border-rose-500/20'
                }`}>
                {isPresent
                  ? <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  : <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                }
                <div>
                  <p className={`text-[13px] font-bold tracking-wide ${isPresent ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPresent ? 'PRESENT' : 'ABSENT'}
                  </p>
                  {!isPresent && (
                     <p className="text-[11px] text-rose-500/80 font-semibold mt-1">
                      Risk Weight: {riskWeight === 3 ? 'Critical Severity' : 'Standard Validation'}
                    </p>
                  )}
                </div>
              </div>

              {/* Excerpt with Redlining Feature */}
              {isPresent && clauseData.excerpt && clauseData.excerpt !== 'N/A' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                       Extracted Text
                     </p>
                     <button 
                       onClick={handleRedline}
                       disabled={isRedlining || redlineResult}
                       className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-50 transition-colors"
                     >
                       {isRedlining ? <Loader2 className="w-3 h-3 animate-spin"/> : <Highlighter className="w-3 h-3" />}
                       {isRedlining ? 'Scanning...' : 'Redline Risks'}
                     </button>
                  </div>
                  <blockquote className="border-l-2 border-indigo-500 pl-4 py-1.5 bg-[#0B0E14] rounded-r-xl pr-3">
                    {isRedlining ? (
                      <div className="flex items-center gap-3 text-indigo-400 py-4">
                        <Loader2 className="w-4 h-4 animate-spin"/>
                        <span className="text-xs font-semibold">Running semantic threat analysis...</span>
                      </div>
                    ) : redlineResult ? (
                      <p 
                        className="text-[13px] text-slate-300 leading-loose prose-marks:bg-rose-500/30 prose-marks:text-rose-200 prose-marks:px-1 prose-marks:rounded prose-marks:font-semibold prose-marks:pb-0.5"
                        dangerouslySetInnerHTML={{ __html: redlineResult }} 
                      />
                    ) : (
                      <p className="text-[13px] text-slate-300 leading-loose">
                        "{clauseData.excerpt}"
                      </p>
                    )}
                  </blockquote>
                  {clauseData.page_hint && clauseData.page_hint !== 'N/A' && (
                    <p className="text-[11px] text-slate-500 font-bold mt-2 flex items-center gap-1.5">
                       📄 {clauseData.page_hint}
                    </p>
                  )}
                </div>
              )}

              {/* Absent details with Auto-Drafter */}
              {!isPresent && (
                <div className="space-y-4">
                   {CRITICAL.includes(clauseData.clause_type) && (
                     <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4">
                       <p className="text-[13px] font-bold text-orange-400 mb-1 flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4"/> Critical Liability Exposure
                       </p>
                       <p className="text-xs text-orange-400/80 font-medium leading-relaxed">
                         The absence of this clause exposes the organization to unbounded risk. Immediate remediation recommended.
                       </p>
                     </div>
                   )}
                   
                   <div className="pt-2 border-t border-[#1F2433]">
                      <div className="flex items-center justify-between mb-3">
                         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                           Remediation Tools
                         </p>
                      </div>
                      
                      {draftResult ? (
                         <div className="rounded-xl bg-[#0B0E14] border border-[#1F2433] p-4">
                           <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                             <CheckCircle className="w-3.5 h-3.5"/> Standard Draft Generated
                           </p>
                           <div className="prose prose-invert prose-sm text-slate-300 leading-relaxed max-w-none">
                             <div dangerouslySetInnerHTML={{ __html: draftResult.replace(/\n/g, '<br/>') }} />
                           </div>
                         </div>
                      ) : (
                         <button
                           onClick={handleDraft}
                           disabled={isDrafting}
                           className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1E2336] hover:bg-[#2A3143] text-white text-[13px] font-bold transition-all disabled:opacity-50"
                         >
                           {isDrafting ? <Loader2 className="w-4 h-4 animate-spin"/> : <PenTool className="w-4 h-4"/>}
                           {isDrafting ? 'Drafting standard clause...' : 'Auto-Draft Favorable Clause'}
                         </button>
                      )}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {clauseData && !loading && (
          <div className="p-5 border-t border-[#1F2433] bg-[#0B0E14]">
            <button
              onClick={handleAskAI}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl
                bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold
                transition-transform active:scale-[0.98] shadow-lg"
            >
              Research Clause Context in Chat
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}