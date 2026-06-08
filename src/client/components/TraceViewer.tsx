import { useState, useEffect, useRef } from 'react'
import { useSession } from '../hooks/useSessions'
import { TurnCard } from './TurnCard'
import { SourceBadge, getSourceConfig } from './SourceBadge'
import { SourceIcon } from './SourceIcon'
import { exportAsJSON, exportAsMarkdown, exportAsHTML } from '../utils/exportTrace'
import type { SessionMeta } from '@shared/types'

function shortPath(p = '') {
  return p.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')
}

function displayTitle(meta: SessionMeta) {
  return meta.title || meta.summary || shortPath(meta.cwd) || 'Root Directory'
}

function shortSessionId(id: string) {
  return id.replace(/^session_/, '').replace(/-/g, '').slice(0, 10) || id.slice(0, 10)
}

export function TraceViewer({ meta }: { meta: SessionMeta }) {
  const { session, loading, error } = useSession(meta)
  const config = getSourceConfig(meta.source)
  const totalTools = session?.toolCallCount ?? meta.toolCallCount ?? session?.turns.reduce((n, t) => n + t.steps.filter(s => s.type === 'tool_use').length, 0) ?? 0
  const requestCount = session?.turns.length ?? meta.turnCount
  const eventCount = session?.eventCount ?? meta.eventCount
  const title = session?.title || session?.summary || displayTitle(meta)
  const path = shortPath(session?.cwd || meta.cwd)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Premium Header */}
      <header className="flex-shrink-0 z-20 bg-surface-1/80 backdrop-blur-2xl border-b border-border-2 px-8 py-5 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            {/* Source Icon with Premium Glow */}
            <div className="relative group flex-shrink-0">
              <div 
                className="absolute -inset-1 rounded-xl blur-lg opacity-15 group-hover:opacity-30 transition-opacity duration-500"
                style={{ backgroundColor: config.color }} 
              />
              <div 
                className="relative w-12 h-12 rounded-xl flex items-center justify-center border shadow-premium transition-all duration-500 group-hover:scale-105"
                style={{ 
                  backgroundColor: 'var(--bg-0)',
                  borderColor: config.badgeBorder,
                  color: config.color 
                }}
              >
                <SourceIcon source={meta.source} className="w-7 h-7" />
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <SourceBadge source={meta.source} />
                {meta.model && (
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-surface-3 text-text-2 border border-border-1 uppercase tracking-wider shadow-sm">
                    {meta.model.split('/').pop()?.split(':')[0]}
                  </span>
                )}
                <span className="text-[9px] font-mono text-text-4 select-all opacity-60 hover:opacity-100 transition-opacity cursor-help" title={meta.id}>
                  #{shortSessionId(meta.id)}
                </span>
              </div>
              
              <h2 className="text-xl font-extrabold text-text-1 truncate tracking-tight font-sans leading-tight" title={title}>
                {title}
              </h2>
              {path && title !== path && (
                <div className="text-[10px] font-mono text-text-4 truncate opacity-75" title={session?.cwd || meta.cwd}>
                  {path}
                </div>
              )}

              <div className="flex items-center gap-2 text-[10px] text-text-3 font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-2 border border-border-1">
                  <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(meta.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-2 border border-border-1">
                  <span className="text-text-1">{requestCount}</span> requests
                </div>
                {eventCount ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-2 border border-border-1">
                    <span className="text-text-1">{eventCount}</span> events
                  </div>
                ) : null}
                {totalTools > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-2 border border-border-1">
                    <span className="text-text-1">{totalTools}</span> tool calls
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative" ref={exportRef}>
              <button
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 border border-border-2 text-text-2 font-bold text-xs hover:bg-surface-3 hover:text-text-1 transition-all active:scale-95 shadow-sm"
                onClick={() => setExportOpen(x => !x)}
                disabled={!session}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
              {exportOpen && session && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-border-2 bg-surface-1 shadow-premium py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    className="w-full text-left px-4 py-2.5 text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 transition-colors flex items-center gap-3 font-bold"
                    onClick={() => { exportAsJSON(session, meta); setExportOpen(false) }}
                  >
                    <div className="w-7 h-7 rounded-lg bg-accent-user/10 flex items-center justify-center text-accent-user">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    Export as JSON
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 transition-colors flex items-center gap-3 font-bold"
                    onClick={() => { exportAsHTML(session, meta); setExportOpen(false) }}
                  >
                    <div className="w-7 h-7 rounded-lg bg-accent-tool/10 flex items-center justify-center text-accent-tool">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    Export as HTML
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 transition-colors flex items-center gap-3 font-bold"
                    onClick={() => { exportAsMarkdown(session, meta); setExportOpen(false) }}
                  >
                    <div className="w-7 h-7 rounded-lg bg-accent-agent/10 flex items-center justify-center text-accent-agent">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    </div>
                    Export as Markdown
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-0 px-10">
        <div className="max-w-5xl mx-auto py-12 pb-40">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-8">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-3xl border-4 border-surface-3 rotate-45 opacity-20" />
                <div 
                  className="absolute inset-0 rounded-3xl border-4 border-t-transparent animate-spin" 
                  style={{ borderTopColor: config.color }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">
                  ⌬
                </div>
              </div>
              <div className="space-y-2 text-center">
                <p className="text-base font-extrabold text-text-1 tracking-tight">Reconstructing Trace</p>
                <p className="text-xs font-bold text-text-4 uppercase tracking-[0.2em]">Assembling session architecture…</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 rounded-3xl bg-accent-error-bg border border-accent-error-border text-accent-error flex items-start gap-6 shadow-lg animate-in fade-in zoom-in duration-500">
              <div className="w-12 h-12 rounded-2xl bg-accent-error/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-extrabold tracking-tight">Trace Parsing Failure</h4>
                <p className="text-sm font-medium opacity-80 leading-relaxed max-w-2xl">{error}</p>
              </div>
            </div>
          ) : session ? (
            <div className="space-y-16 animate-slide-up">
              {session.turns.length === 0 ? (
                <div className="text-center py-32 text-text-4 bg-surface-1 rounded-[40px] border-2 border-dashed border-border-2 transition-all hover:bg-surface-2 hover:border-border-3 group">
                  <div className="text-6xl mb-6 grayscale opacity-20 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700">📭</div>
                  <h3 className="text-xl font-extrabold text-text-2 mb-2 tracking-tight">Empty Session</h3>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">This session contains no trace data.</p>
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
