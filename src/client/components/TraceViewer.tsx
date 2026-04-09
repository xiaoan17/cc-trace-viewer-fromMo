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
  const config = getSourceConfig(meta.source)
  const totalTools = session?.turns.reduce((n, t) => n + t.steps.filter(s => s.type === 'tool_use').length, 0) ?? 0

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Premium Header */}
      <header className="flex-shrink-0 z-20 bg-surface-1/80 backdrop-blur-xl border-b border-border-2 px-8 py-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-6">
          <div className="flex items-start gap-5 min-w-0">
            {/* Source Icon with Glow */}
            <div className="relative group flex-shrink-0">
              <div 
                className="absolute inset-0 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" 
                style={{ backgroundColor: config.color }} 
              />
              <div 
                className="relative w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-lg transition-transform group-hover:scale-105"
                style={{ 
                  backgroundColor: 'var(--bg-0)',
                  borderColor: config.badgeBorder,
                  color: config.color 
                }}
              >
                <SourceIcon source={meta.source} className="w-8 h-8" />
              </div>
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <SourceBadge source={meta.source} />
                {meta.model && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-surface-3 text-text-2 border border-border-1 uppercase tracking-wider">
                    {meta.model.split('/').pop()?.split(':')[0]}
                  </span>
                )}
                <span className="text-[11px] font-mono text-text-4 select-all">
                  {meta.id}
                </span>
              </div>
              
              <h2 className="text-xl font-bold text-text-1 truncate tracking-tight font-mono">
                {shortPath(meta.cwd) || 'Root Directory'}
              </h2>

              <div className="flex items-center gap-3 text-xs text-text-3 font-medium">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(meta.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <span className="w-1 h-1 rounded-full bg-border-3" />
                <div className="flex items-center gap-1.5">
                  <span className="text-text-2">{meta.turnCount}</span> turns
                </div>
                {session && totalTools > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-border-3" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-2">{totalTools}</span> tool calls
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons (Future: Export, Share, etc.) */}
          <div className="hidden sm:flex items-center gap-2">
            <button className="btn-icon" title="Copy Session ID">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-0">
        <div className="max-w-5xl mx-auto px-8 py-10 pb-32">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-5">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-surface-3" />
                <div 
                  className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" 
                  style={{ borderTopColor: config.color }}
                />
              </div>
              <p className="text-sm font-medium text-text-4 animate-pulse">Reconstructing trace architecture…</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-accent-error-bg border border-accent-error-border text-accent-error flex items-start gap-4">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="space-y-1">
                <h4 className="font-bold">Parsing Error</h4>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          ) : session ? (
            <div className="space-y-12">
              {session.turns.length === 0 ? (
                <div className="text-center py-24 text-text-4 bg-surface-1 rounded-3xl border-2 border-dashed border-border-2">
                  <div className="text-4xl mb-4 opacity-20">📭</div>
                  <p className="text-sm font-medium">This session contains no trace data.</p>
                </div>
              ) : (
                session.turns.map((turn, i) => (
                  <TurnCard key={turn.id} turn={turn} index={i} />
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
