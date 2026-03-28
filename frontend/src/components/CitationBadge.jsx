import { useState, useRef, useEffect } from 'react'
import { FileText, X } from 'lucide-react'

export default function CitationBadge({ source }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const short =
    source.contract_name.length > 28
      ? source.contract_name.slice(0, 26) + '…'
      : source.contract_name

  const pageLabel =
    source.page_hint && source.page_hint !== 'N/A' ? ` · ${source.page_hint}` : ''

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={source.contract_name}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium
          bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400
          border border-blue-200 dark:border-blue-800/60
          hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
      >
        <FileText className="w-3 h-3 flex-shrink-0" />
        {short}{pageLabel}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-80 rounded-xl shadow-xl
          bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug">
              {source.contract_name}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {source.page_hint && source.page_hint !== 'N/A' && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">
              Section: {source.page_hint}
            </p>
          )}
          <blockquote className="border-l-2 border-blue-400 dark:border-blue-600 pl-2.5">
            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed italic">
              "{source.excerpt.slice(0, 300)}{source.excerpt.length > 300 ? '…' : ''}"
            </p>
          </blockquote>
        </div>
      )}
    </div>
  )
}