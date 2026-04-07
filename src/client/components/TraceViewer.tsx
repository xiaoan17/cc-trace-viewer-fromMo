import { useSession } from '../hooks/useSessions'
import { TurnCard } from './TurnCard'
import { SourceBadge, getSourceConfig } from './SourceBadge'
import { SourceIcon } from './SourceIcon'
import type { SessionMeta } from '@shared/types'

function shortPath(p = '') {
  return p.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')
}

export function TraceViewer({ meta }: { meta: SessionMeta }) {
  const { session, loading, error } = useSession(meta)
  const c = getSourceConfig(meta.source)
  const totalTools = session?.turns.reduce((n, t) => n + t.steps.filter(s => s.type === 'tool_use').length, 0) ?? 0

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-0)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 px-7 py-5"
        style={{ background: 'var(--bg-1)', borderBottom: '1.5px solid var(--border-2)' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: c.badgeBg,
              border: `1.5px solid ${c.badgeBorder}`,
              boxShadow: `0 2px 12px ${c.glow}`,
            }}
          >
            <SourceIcon source={meta.source} className="h-6 w-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <SourceBadge source={meta.source} />
              {meta.model && (
                <span
                  className="text-sm font-mono px-2.5 py-0.5 rounded-lg"
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}
                >
                  {meta.model.split('/').pop()?.split(':')[0]}
                </span>
              )}
            </div>
            <div className="font-mono text-base font-semibold truncate mb-2" style={{ color: 'var(--text-1)' }}>
              {shortPath(meta.cwd) || '—'}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-sm" style={{ color: 'var(--text-3)' }}>
              <span>{new Date(meta.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span style={{ color: 'var(--border-2)' }}>·</span>
              <span>{meta.turnCount} turns</span>
              {session && totalTools > 0 && (
                <>
                  <span style={{ color: 'var(--border-2)' }}>·</span>
                  <span>{totalTools} tool calls</span>
                </>
              )}
              <span style={{ color: 'var(--border-2)' }}>·</span>
              <span className="font-mono text-xs">{meta.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center h-52 gap-4">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: c.color, borderTopColor: 'transparent' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-4)' }}>Parsing session…</span>
          </div>
        )}

        {error && (
          <div
            className="mx-7 mt-6 px-5 py-4 rounded-2xl text-sm"
            style={{ background: 'var(--accent-error-bg)', border: '1.5px solid var(--accent-error-border)', color: 'var(--accent-error-text)' }}
          >
            {error}
          </div>
        )}

        {!loading && !error && session && (
          <div className="max-w-6xl mx-auto px-6 pt-8 pb-16">
            {session.turns.length === 0 ? (
              <div className="text-center py-20 text-base" style={{ color: 'var(--text-4)' }}>
                No turns found
              </div>
            ) : (
              session.turns.map((turn, i) => (
                <TurnCard key={turn.id} turn={turn} index={i} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
