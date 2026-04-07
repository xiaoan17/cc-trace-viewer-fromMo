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
  // Show last 2 path segments
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
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-1)' }}>

      {/* Wordmark */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative w-8 h-8 flex-shrink-0">
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                boxShadow: '0 0 20px rgba(139,92,246,0.4)',
              }}
            />
            <span className="relative z-10 flex items-center justify-center w-full h-full text-white text-sm font-bold">
              ⌬
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">Trace Viewer</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-4)' }}>
              {loading ? 'Scanning…' : `${sessions.length} sessions`}
            </div>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-3 transition-all"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border-1)',
          }}
          onFocus={(e: React.FocusEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = 'var(--border-3)' }}
          onBlur={(e: React.FocusEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = 'var(--border-1)' }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-4)' }} viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder-[var(--text-4)]"
            style={{ color: 'var(--text-1)' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs w-4 h-4 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-3)' }}
            >
              ×
            </button>
          )}
        </div>

        {/* Source tabs */}
        <div
          className="flex rounded-lg p-0.5 gap-0.5"
          style={{ background: 'var(--bg-0)', border: '1px solid var(--border-1)' }}
        >
          <TabBtn active={src === 'all'} onClick={() => setSrc('all')}>
            All <span style={{ color: 'var(--text-3)' }}>{sessions.length}</span>
          </TabBtn>
          {SOURCES.map(s => {
            const c = getSourceConfig(s)
            return (
              <TabBtn
                key={s}
                active={src === s}
                color={src === s ? c.color : undefined}
                onClick={() => setSrc(src === s ? 'all' : s)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <SourceIcon source={s} className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{counts[s] || 0}</span>
                </span>
              </TabBtn>
            )
          })}
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border-1)', flexShrink: 0 }} />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && <SkeletonList />}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-4)' }}>
            <div className="text-3xl mb-2 opacity-40">∅</div>
            <div className="text-xs">No sessions found</div>
          </div>
        )}

        {!loading && SOURCES.map(source => {
          if (src !== 'all' && src !== source) return null
          const items = filtered.filter(s => s.source === source)
          if (!items.length) return null
          const c = getSourceConfig(source)

          return (
            <div key={source}>
              <div
                className="sticky top-0 z-10 flex items-center justify-between px-5 py-2"
                style={{
                  background: 'var(--bg-1)',
                  borderBottom: '1px solid var(--border-1)',
                }}
              >
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: c.color }}
                >
                  <SourceIcon source={source} className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{c.label}</span>
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>{items.length}</span>
              </div>
              {items.map(m => (
                <SessionRow
                  key={m.filePath}
                  meta={m}
                  active={selected?.filePath === m.filePath}
                  onClick={() => onSelect(m)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabBtn({ active, color, onClick, children }: {
  active: boolean; color?: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 text-[10px] font-semibold px-1.5 py-1.5 rounded-md transition-all text-center"
      style={{
        background: active ? 'var(--bg-3)' : 'transparent',
        color: active ? (color || 'var(--text-1)') : 'var(--text-4)',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

function SessionRow({ meta, active, onClick }: {
  meta: SessionMeta; active: boolean; onClick: () => void
}) {
  const c = getSourceConfig(meta.source)
  const shortId = meta.id.replace(/-/g, '').slice(0, 8)

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 flex items-center gap-3 relative transition-all"
      style={{
        background: active ? 'var(--bg-3)' : 'transparent',
        borderBottom: '1px solid var(--border-1)',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-2)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Active accent bar */}
      {active && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
          style={{ background: c.color, boxShadow: `0 0 8px ${c.glow}` }}
        />
      )}

      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center transition-all"
        style={{
          background: active ? c.color + '22' : 'var(--bg-3)',
          border: `1.5px solid ${active ? c.color + '66' : 'var(--border-2)'}`,
          boxShadow: active ? `0 0 10px ${c.glow}` : 'none',
        }}
      >
        <SourceIcon source={meta.source} className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: path + time */}
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <div
            className="text-xs font-mono truncate leading-tight"
            style={{ color: active ? 'var(--text-1)' : 'var(--text-2)' }}
          >
            {shortPath(meta.cwd)}
          </div>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-4)' }}>
            {timeAgo(meta.startedAt)}
          </span>
        </div>
        {/* Bottom row: session ID + turns */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: active ? c.color + '18' : 'var(--bg-2)',
              color: active ? c.color : 'var(--text-4)',
              border: `1px solid ${active ? c.color + '33' : 'var(--border-1)'}`,
            }}
          >
            #{shortId}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>
            {meta.turnCount} turns
          </span>
          {meta.model && (
            <>
              <span style={{ color: 'var(--border-2)' }}>·</span>
              <span className="text-[10px] truncate" style={{ color: 'var(--text-4)', maxWidth: '70px' }}>
                {meta.model.split('/').pop()?.split(':')[0]?.slice(0, 16)}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

function SkeletonList() {
  return (
    <div className="px-5 pt-4 space-y-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--bg-4)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 rounded" style={{ background: 'var(--bg-3)', width: `${55 + (i * 13) % 35}%` }} />
            <div className="h-2 rounded" style={{ background: 'var(--bg-2)', width: `${30 + (i * 7) % 25}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
