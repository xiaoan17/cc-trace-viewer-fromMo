import { useState, useMemo } from 'react'
import { useSessions } from '../hooks/useSessions'
import { getSourceConfig } from './SourceBadge'
import { SourceIcon } from './SourceIcon'
import type { SessionMeta, Source } from '@shared/types'

const SOURCES: Source[] = ['claude', 'codex', 'gemini']

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m`
    if (h < 24) return `${h}h`
    if (d < 30) return `${d}d`
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch { return '' }
}

function shortPath(p = '') {
  const s = p.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')
  const parts = s.split('/').filter(Boolean)
  if (parts.length > 2) return '…/' + parts.slice(-2).join('/')
  return s || '~'
}

export function SessionList({ selected, onSelect }: {
  selected: SessionMeta | null
  onSelect: (m: SessionMeta) => void
}) {
  const { sessions, loading } = useSessions()
  const [query, setQuery] = useState('')
  const [src, setSrc] = useState<Source | 'all'>('all')

  const filtered = useMemo(() => sessions.filter(s => {
    if (src !== 'all' && s.source !== src) return false
    if (query) {
      const q = query.toLowerCase()
      return (s.cwd || '').toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    }
    return true
  }), [sessions, query, src])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    sessions.forEach(s => { m[s.source] = (m[s.source] || 0) + 1 })
    return m
  }, [sessions])

  return (
    <div className="flex flex-col h-full bg-surface-1">
      {/* Header Area */}
      <div className="p-5 space-y-5">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex-shrink-0 group">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 blur-[2px] group-hover:blur-[4px] transition-all" />
            <div className="relative z-10 flex items-center justify-center w-full h-full bg-white dark:bg-slate-900 rounded-xl text-text-1 text-lg font-bold border border-white/20">
              ⌬
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-text-1 tracking-tight truncate">Trace Viewer</h1>
            <p className="text-[10px] text-text-4 font-medium uppercase tracking-wider">
              {loading ? 'Scanning files…' : `${sessions.length} sessions found`}
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-3.5 h-3.5 text-text-4 group-focus-within:text-accent-user transition-colors" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search sessions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-surface-2 border border-border-1 focus:border-accent-user/50 focus:ring-4 focus:ring-accent-user/5 rounded-lg py-2 pl-9 pr-8 text-xs text-text-1 placeholder-text-4 outline-none transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-2 px-1 flex items-center text-text-4 hover:text-text-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex bg-surface-2 p-1 rounded-lg border border-border-1">
          <FilterBtn active={src === 'all'} onClick={() => setSrc('all')}>
            All <span className="ml-1 opacity-50">{sessions.length}</span>
          </FilterBtn>
          {SOURCES.map(s => (
            <FilterBtn
              key={s}
              active={src === s}
              onClick={() => setSrc(src === s ? 'all' : s)}
            >
              <div className="flex items-center gap-1.5 justify-center">
                <SourceIcon source={s} className="w-3.5 h-3.5" />
                <span>{counts[s] || 0}</span>
              </div>
            </FilterBtn>
          ))}
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto border-t border-border-1 custom-scrollbar">
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-4">
            <div className="text-3xl mb-3 opacity-20 italic font-serif">∅</div>
            <div className="text-[11px] font-medium tracking-wide uppercase">No sessions found</div>
          </div>
        ) : (
          SOURCES.map(source => {
            if (src !== 'all' && src !== source) return null
            const items = filtered.filter(s => s.source === source)
            if (!items.length) return null
            const config = getSourceConfig(source)

            return (
              <div key={source} className="group/section">
                <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-2.5 bg-surface-1/90 backdrop-blur-md border-b border-border-1">
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: config.color }}>
                    <SourceIcon source={source} className="w-3.5 h-3.5" />
                    {config.label}
                  </span>
                  <span className="text-[10px] font-mono text-text-4">{items.length}</span>
                </div>
                <div className="divide-y divide-border-1/50">
                  {items.map(m => (
                    <SessionRow
                      key={m.filePath}
                      meta={m}
                      active={selected?.filePath === m.filePath}
                      onClick={() => onSelect(m)}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function FilterBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-[10px] font-bold px-2 py-1.5 rounded-md transition-all ${
        active 
          ? 'bg-surface-0 text-text-1 shadow-sm border border-border-1 ring-1 ring-black/5' 
          : 'text-text-4 hover:text-text-2'
      }`}
    >
      {children}
    </button>
  )
}

function SessionRow({ meta, active, onClick }: {
  meta: SessionMeta; active: boolean; onClick: () => void
}) {
  const config = getSourceConfig(meta.source)
  const shortId = meta.id.replace(/-/g, '').slice(0, 8)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 group relative transition-all duration-200 outline-none ${
        active 
          ? 'bg-surface-2 ring-1 ring-inset ring-border-2' 
          : 'hover:bg-surface-2/50'
      }`}
    >
      {/* Active Indicator */}
      {active && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-accent-user shadow-[0_0_12px_rgba(79,70,229,0.5)] z-20" />
      )}

      <div className="flex items-start gap-3.5">
        {/* Avatar/Icon */}
        <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-300 border ${
          active 
            ? 'bg-white dark:bg-slate-800 border-border-2 shadow-sm scale-110' 
            : 'bg-surface-3 border-transparent group-hover:border-border-2'
        }`}>
          <SourceIcon source={meta.source} className={`w-5 h-5 transition-transform group-hover:scale-110 ${active ? 'opacity-100' : 'opacity-70'}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className={`text-xs font-mono truncate transition-colors ${active ? 'text-text-1 font-semibold' : 'text-text-2 group-hover:text-text-1'}`}>
              {shortPath(meta.cwd)}
            </h4>
            <span className="text-[10px] text-text-4 tabular-nums">
              {timeAgo(meta.startedAt)}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
              active 
                ? 'bg-accent-user/10 border-accent-user/30 text-accent-user' 
                : 'bg-surface-3 border-border-1 text-text-4'
            }`}>
              #{shortId}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-text-4">
              <span className="font-medium text-text-3">{meta.turnCount}</span>
              <span className="opacity-40">turns</span>
            </div>
            {meta.model && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="w-1 h-1 rounded-full bg-border-3" />
                <span className="text-[10px] text-text-4 truncate font-medium">
                  {meta.model.split('/').pop()?.split(':')[0]}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function SkeletonList() {
  return (
    <div className="p-5 space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-surface-3" />
          <div className="flex-1 space-y-2.5 py-1">
            <div className="h-3 bg-surface-3 rounded w-3/4" />
            <div className="h-2 bg-surface-2 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
