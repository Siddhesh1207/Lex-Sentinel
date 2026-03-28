import CitationBadge from './CitationBadge.jsx'

// Simple inline markdown renderer — handles bold, code, tables, lists
function parseInline(text) {
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\⚠️[^\n]*)/g
  const parts = []
  let last = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const tok = match[0]
    if (tok.startsWith('**')) {
      parts.push(<strong key={key++} className="font-semibold">{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('`')) {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-[#1E2336] text-indigo-300">
          {tok.slice(1, -1)}
        </code>
      )
    } else {
      parts.push(<span key={key++} className="text-amber-500 font-bold">{tok}</span>)
    }
    last = regex.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function MarkdownBlock({ text }) {
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code fence
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3)
      const code = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i++
      }
      i++
      elements.push(
        <pre key={i} className="my-2 p-3 rounded-lg bg-[#0B0E14] border border-[#1F2433] text-indigo-200 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
          {code.join('\n')}
        </pre>
      )
      continue
    }

    // Table
    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i])
        i++
      }
      const headers = rows[0].split('|').filter(Boolean).map((s) => s.trim())
      const dataRows = rows.slice(2).map((r) => r.split('|').filter(Boolean).map((s) => s.trim()))
      elements.push(
        <div key={i} className="my-2 overflow-x-auto rounded-lg border border-[#1F2433]">
          <table className="text-xs w-full text-slate-300">
            <thead className="bg-[#0B0E14]">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-3 py-2 text-left font-bold tracking-wide text-slate-400 border-b border-[#1F2433]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} className="border-t border-[#1F2433] even:bg-[#0B0E14]/50">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-300">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Bullet list
    if (line.match(/^\s*[-*]\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\s*[-*]\s/)) {
        items.push(lines[i].replace(/^\s*[-*]\s/, ''))
        i++
      }
      elements.push(
        <ul key={i} className="my-2 space-y-1 list-disc list-inside text-slate-300">
          {items.map((item, ii) => (
            <li key={ii} className="text-[14px] leading-relaxed">{parseInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list
    if (line.match(/^\s*\d+\.\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s/)) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={i} className="my-2 space-y-1 list-decimal list-inside text-slate-300">
          {items.map((item, ii) => (
            <li key={ii} className="text-[14px] leading-relaxed">{parseInline(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />)
      i++
      continue
    }

    // Default paragraph
    elements.push(
      <p key={i} className="text-[14px] leading-relaxed text-slate-300">
        {parseInline(line)}
      </p>
    )
    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}

export default function ChatBubble({ role, content, sources }) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-indigo-600 text-white rounded-2xl rounded-tr-md px-5 py-3 shadow-md">
          <p className="text-[14px] font-semibold leading-relaxed">{content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start mb-6 max-w-[85%]">
      <div className="bg-[#151822] border border-[#1F2433] rounded-2xl rounded-tl-md px-5 py-4 shadow-xl w-full">
        <MarkdownBlock text={content} />
      </div>
      {sources && sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 px-1">
          {sources.map((src, i) => (
            <CitationBadge key={i} source={src} />
          ))}
        </div>
      )}
    </div>
  )
}