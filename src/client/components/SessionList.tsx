import { useEffect, useState, useMemo } from 'react'
import { useSessions } from '../hooks/useSessions'
import { getSourceConfig } from './SourceBadge'
import { SourceIcon } from './SourceIcon'
import type { SessionAgeRange, SessionMeta, Source } from '@shared/types'

const SOURCES: Source[] = ['claude', 'codex', 'kimi']
const AGE_RANGES: Array<{ value: SessionAgeRange; label: string }> = [
  { value: '1d', label: '1d' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'older', label: 'Other' },
]

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

function shortSessionId(id: string) {
  return id.replace(/^session_/, '').replace(/-/g, '').slice(0, 8) || id.slice(0, 8)
}

export function SessionList({ selected, onSelect }: {
  selected: SessionMeta | null
  onSelect: (m: SessionMeta | null) => void
}) {
  const [ageRange, setAgeRange] = useState<SessionAgeRange>('1d')
  const { sessions, loading } = useSessions(ageRange)
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

  useEffect(() => {
    if (!selected || loading) return
    if (!sessions.some(s => s.filePath === selected.filePath)) {
      onSelect(null)
    }
  }, [sessions, loading, selected, onSelect])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    sessions.forEach(s => { m[s.source] = (m[s.source] || 0) + 1 })
    return m
  }, [sessions])

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-border-2">
      {/* Header Area */}
      <div className="p-6 space-y-6">
        {/* Wordmark */}
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 flex-shrink-0 group">
            <div className="absolute inset-0 rounded-xl bg-white shadow-premium ring-1 ring-border-2" />
            <img
              src="/logo.png"
              alt="Trace Viewer"
              className="relative z-10 w-full h-full rounded-xl object-cover object-top transition-transform duration-500 group-hover:scale-105"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-text-1 tracking-tight truncate">Trace Viewer</h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-success animate-pulse" />
              <p className="text-[10px] text-text-4 font-bold uppercase tracking-widest">
                {loading ? 'Scanning…' : `${sessions.length} sessions`}
              </p>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-text-4 group-focus-within:text-accent-user transition-colors duration-300" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="2"/>
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search sessions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-surface-2 border border-border-2 focus:border-accent-user/50 focus:ring-4 focus:ring-accent-user/10 rounded-xl py-2.5 pl-10 pr-9 text-xs text-text-1 placeholder-text-4 outline-none transition-all duration-300"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-2.5 px-1 flex items-center text-text-4 hover:text-text-1 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Time Range */}
        <div className="grid grid-cols-4 gap-1 bg-surface-2 p-1 rounded-xl border border-border-2 shadow-sm">
          {AGE_RANGES.map(range => (
            <FilterBtn
              key={range.value}
              active={ageRange === range.value}
              onClick={() => setAgeRange(range.value)}
            >
              {range.label}
            </FilterBtn>
          ))}
        </div>

        {/* Source Filters */}
        <div className="flex bg-surface-2 p-1 rounded-xl border border-border-2 shadow-sm">
          <FilterBtn active={src === 'all'} onClick={() => setSrc('all')}>
            All <span className="ml-1 opacity-40 font-mono">{sessions.length}</span>
          </FilterBtn>
          {SOURCES.map(s => (
            <FilterBtn
              key={s}
              active={src === s}
              onClick={() => setSrc(src === s ? 'all' : s)}
            >
              <div className="flex items-center gap-1.5 justify-center">
                <SourceIcon source={s} className="w-3.5 h-3.5" />
                <span className="font-mono">{counts[s] || 0}</span>
              </div>
            </FilterBtn>
          ))}
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto border-t border-border-2 custom-scrollbar px-3 py-4">
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-4 animate-in fade-in duration-500">
            <div className="text-4xl mb-4 opacity-10">∅</div>
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase opacity-60">No sessions found</div>
          </div>
        ) : (
          SOURCES.map(source => {
            if (src !== 'all' && src !== source) return null
            const items = filtered.filter(s => s.source === source)
            if (!items.length) return null
            const config = getSourceConfig(source)

            return (
              <div key={source} className="mb-6 last:mb-0">
                <div className="flex items-center justify-between px-3 mb-3">
                  <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: config.color }}>
                    <SourceIcon source={source} className="w-3.5 h-3.5" />
                    {config.label}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-text-4 bg-surface-2 px-1.5 py-0.5 rounded border border-border-1">{items.length}</span>
                </div>
                <div className="space-y-1">
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
      className={`flex-1 text-[10px] font-bold px-2 py-2 rounded-lg transition-all duration-300 ${
        active 
          ? 'bg-surface-0 text-text-1 shadow-md border border-border-2 ring-1 ring-black/5' 
          : 'text-text-4 hover:text-text-2 hover:bg-surface-0/50'
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
  const shortId = shortSessionId(meta.id)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl group relative transition-all duration-300 outline-none ${
        active 
          ? 'bg-surface-0 shadow-lg border border-border-2 ring-1 ring-black/5 z-10 scale-[1.02]' 
          : 'hover:bg-surface-2 border border-transparent'
      }`}
    >
      {/* Active Indicator */}
      {active && (
        <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-accent-user shadow-[0_0_12px_rgba(99,102,241,0.6)] z-20" />
      )}

      <div className="flex items-start gap-3.5">
        {/* Avatar/Icon */}
        <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-500 border ${
          active 
            ? 'bg-white dark:bg-slate-800 border-border-2 shadow-premium scale-110' 
            : 'bg-surface-3 border-transparent group-hover:bg-surface-0 group-hover:border-border-2 group-hover:shadow-md'
        }`}>
          <SourceIcon source={meta.source} className={`w-6 h-6 transition-transform duration-500 group-hover:scale-110 ${active ? 'opacity-100' : 'opacity-60'}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h4 className={`text-xs font-mono truncate transition-colors duration-300 ${active ? 'text-text-1 font-bold' : 'text-text-2 group-hover:text-text-1'}`}>
              {shortPath(meta.cwd)}
            </h4>
            <span className="text-[10px] font-bold text-text-4 tabular-nums opacity-60">
              {timeAgo(meta.startedAt)}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors duration-300 ${
              active 
                ? 'bg-accent-user/10 text-accent-user border border-accent-user/20' 
                : 'bg-surface-2 text-text-4 border border-border-1'
            }`}>
              #{shortId}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-text-4 font-bold">
              <span className={`transition-colors ${active ? 'text-text-2' : 'text-text-3'}`}>{meta.turnCount}</span>
              <span className="opacity-40 uppercase text-[9px] tracking-wider">turns</span>
            </div>
            {meta.model && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="w-1 h-1 rounded-full bg-border-3" />
                <span className="text-[9px] text-text-4 truncate font-bold uppercase tracking-tight opacity-70">
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
    <div className="space-y-4 px-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse p-2">
          <div className="w-11 h-11 rounded-xl bg-surface-3" />
          <div className="flex-1 space-y-3 py-1.5">
            <div className="h-3 bg-surface-3 rounded-full w-3/4" />
            <div className="h-2 bg-surface-2 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
