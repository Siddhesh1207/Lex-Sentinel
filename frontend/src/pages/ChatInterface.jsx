import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Send, X, CheckSquare, Square, Search } from 'lucide-react'
import ChatBubble from '../components/ChatBubble.jsx'
import { fetchContracts, sendChatMessage } from '../services/api.js'

const QUICK_PROMPTS = [
  'What are the key risks in this contract?',
  'Does this contract have an Audit Rights clause?',
  'Compare termination clauses across selected contracts.',
  'Show all missing critical clauses.',
]

export default function ChatInterface() {
  const location = useLocation()
  const [contracts, setContracts] = useState([])
  const [contractSearch, setContractSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingContracts, setLoadingContracts] = useState(true)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    fetchContracts()
      .then(setContracts)
      .catch(() => toast.error('Could not load contract list'))
      .finally(() => setLoadingContracts(false))
  }, [])

  // Handle pre-fill from ClauseDrawer navigation
  useEffect(() => {
    if (location.state?.prefillContract) {
      setSelected([location.state.prefillContract])
    }
    if (location.state?.prefillQuery) {
      setInput(location.state.prefillQuery)
      textareaRef.current?.focus()
    }
  }, [location.state])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const filteredContracts = contracts.filter((c) =>
    c.toLowerCase().includes(contractSearch.toLowerCase())
  )

  function toggleContract(name) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  async function sendMessage(text) {
    const query = text.trim()
    if (!query || loading) return

    const userMsg = { role: 'user', content: query }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await sendChatMessage(query, selected, history)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.answer, sources: res.sources ?? [] },
      ])
    } catch (e) {
      toast.error(`Chat error: ${e.message}`)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Sorry, I couldn't process that request. ${e.message}`,
          sources: [],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex h-screen bg-[#0B0E14] text-slate-200">
      {/* Left: Contract selector */}
      <div className="w-[300px] flex-shrink-0 border-r border-[#1F2433] bg-[#151822] flex flex-col z-10 pt-6">
        <div className="px-5 pb-5 border-b border-[#1F2433]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search contracts..."
              value={contractSearch}
              onChange={(e) => setContractSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl border border-[#1F2433]
                bg-[#0B0E14] text-slate-200
                placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-6 mb-2">
            All Contracts
          </h2>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelected(contracts)}
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Select All
            </button>
            <span className="text-[10px] text-slate-500 font-bold">
              {selected.length} / {contracts.length}
            </span>
            <button
              onClick={() => setSelected([])}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loadingContracts ? (
            <div className="flex items-center justify-center h-20 text-indigo-500">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredContracts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-4">No contracts found.</p>
          ) : (
            filteredContracts.map((name) => {
              const isSelected = selected.includes(name)
              return (
                <button
                  key={name}
                  onClick={() => toggleContract(name)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all border ${isSelected
                      ? 'bg-[#1E2336] text-white border-[#2A3143]'
                      : 'border-transparent text-slate-400 hover:bg-[#1A1D27] hover:border-[#1F2433]'
                    }`}
                >
                  <div className="min-w-0 pr-3">
                    <span className="text-[13px] font-bold block truncate">{name}</span>
                    <span className="text-[10px] text-slate-500 truncate mt-0.5 block line-clamp-1">Last analyzed 2h ago</span>
                  </div>
                  {isSelected && <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />}
                </button>
              )
            })
          )}
        </div>
        <div className="p-4 border-t border-[#1F2433]">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1E2336] hover:bg-[#252B42] text-white text-xs font-bold transition-colors">
            Upload Contract
          </button>
        </div>
      </div>

      {/* Right: Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0B0E14] relative">
        {/* Topbar */}
        <div className="px-8 py-5 border-b border-[#1F2433] bg-[#0B0E14] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <span className="text-indigo-400 text-lg">✨</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Intelligence Stream</h1>
              <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 uppercase mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> GPT-4 Enterprise Optimized
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <div className="w-14 h-14 rounded-2xl bg-[#151822] border border-[#1F2433] shadow-xl flex items-center justify-center">
                <span className="text-2xl">⚡️</span>
              </div>
              <div className="text-center max-w-md">
                <p className="text-base font-bold text-white mb-2">
                  Lex-Sentinel AI Assistant
                </p>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                  Select contracts from the left panel to begin. You can ask for risk assessments, cross-contract comparisons, or specific clause identification.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 w-full max-w-md mt-6">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="px-4 py-3.5 rounded-xl text-left text-sm font-semibold
                      bg-[#151822] border border-[#1F2433] text-slate-300
                      hover:bg-[#1A1D27] hover:border-indigo-500/50 hover:text-white
                      transition-all shadow-sm flex items-center justify-between group"
                  >
                    <span>{p}</span>
                    <Send className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} sources={msg.sources} />
          ))}

          {loading && (
            <div className="flex items-start mb-6">
               <div className="w-8 h-8 rounded-lg bg-[#151822] flex items-center justify-center flex-shrink-0 border border-[#1F2433] mt-1 mr-4">
                 <span className="text-sm">✨</span>
               </div>
              <div className="bg-[#151822] border border-[#1F2433] rounded-2xl rounded-tl-md px-5 py-4 shadow-sm min-w-[120px]">
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-6 pt-2 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14] to-transparent">
          <div className="max-w-4xl mx-auto">
            <div className="bg-[#151822] border border-[#1F2433] rounded-2xl p-2 shadow-2xl focus-within:border-indigo-500/50 transition-colors">
              <div className="px-4 py-2 flex items-center gap-2 border-b border-[#1F2433]/50 mb-2">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Suggested:</span>
                 <div className="flex gap-2">
                   {['Draft counter-clause', 'Summarize liabilities', 'Extract signatories'].map(t => (
                     <button key={t} className="px-2 py-1 bg-[#1A1D27] hover:bg-[#1E2336] rounded text-[10px] font-semibold text-slate-400">{t}</button>
                   ))}
                 </div>
              </div>
              <div className="flex items-end gap-3 px-2 pb-2">
                <div className="pb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1A1D27] flex items-center justify-center text-slate-500 hover:text-white cursor-pointer transition-colors">
                    📎
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Lex-Sentinel anything about your contracts..."
                  rows={2}
                  disabled={loading}
                  className="flex-1 resize-none bg-transparent text-[15px] font-medium text-white placeholder-slate-500 focus:outline-none leading-relaxed pt-2.5 custom-scrollbar"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-600 disabled:opacity-50 disabled:bg-[#1A1D27] disabled:text-slate-600 hover:bg-indigo-500 transition-colors flex items-center justify-center shadow-lg"
                >
                  <Send className="w-5 h-5 ml-0.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}