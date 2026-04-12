import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const components: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-5 mb-3 pb-2" style={{ color: 'var(--text-1)', borderBottom: '1.5px solid var(--border-2)' }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold mt-4 mb-2" style={{ color: 'var(--text-1)' }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold mt-3 mb-1.5" style={{ color: 'var(--text-1)' }}>
      {children}
    </h3>
  ),

  // Paragraph
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 break-words text-[15px] font-medium leading-8" style={{ color: 'inherit' }}>
      {children}
    </p>
  ),

  // Inline code
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) return <code className={className}>{children}</code>
    return (
      <code
        className="text-[0.92em] font-mono font-semibold px-1.5 py-0.5 rounded-md"
        style={{
          background: 'var(--bg-0)',
          border: '1px solid var(--border-2)',
          color: 'var(--accent-tool-text)',
        }}
      >
        {children}
      </code>
    )
  },

  // Code block
  pre: ({ children }) => (
    <div className="my-4 overflow-hidden rounded-2xl" style={{ border: '1.5px solid var(--border-2)' }}>
      <div
        className="flex items-center px-3.5 py-1.5"
        style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border-1)' }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-4)' }}>
          code
        </span>
        <div className="ml-auto flex gap-1">
          {['#f87171', '#fbbf24', '#4ade80'].map(c => (
            <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.5 }} />
          ))}
        </div>
      </div>
      <pre
        className="overflow-x-auto px-4 py-4 text-sm font-mono leading-7"
        style={{ background: 'var(--bg-1)', color: 'var(--text-1)', margin: 0 }}
      >
        {children}
      </pre>
    </div>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="mb-3 space-y-2 pl-1" style={{ color: 'inherit' }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 space-y-2 pl-1 list-decimal list-inside" style={{ color: 'inherit' }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-[15px] font-medium leading-8">
      <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--text-4)' }} />
      <span>{children}</span>
    </li>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote
      className="my-4 rounded-r-xl py-2 pl-4 pr-3"
      style={{
        borderLeft: '3px solid var(--accent-user-border)',
        background: 'var(--bg-0)',
        color: 'inherit',
      }}
    >
      {children}
    </blockquote>
  ),

  // Table
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl" style={{ border: '1.5px solid var(--border-2)' }}>
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: 'var(--bg-3)', borderBottom: '1.5px solid var(--border-2)' }}>
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'inherit', borderTop: '1px solid var(--border-1)' }}>
      {children}
    </td>
  ),

  // Horizontal rule
  hr: () => (
    <hr className="my-4" style={{ border: 'none', borderTop: '1.5px solid var(--border-2)' }} />
  ),

  // Strong / em
  strong: ({ children }) => (
    <strong className="font-bold" style={{ color: 'inherit' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic" style={{ color: 'inherit', opacity: 0.92 }}>{children}</em>
  ),

  // Link
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 transition-colors hover:opacity-70"
      style={{ color: 'var(--accent-tool-text)' }}
    >
      {children}
    </a>
  ),
}

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
