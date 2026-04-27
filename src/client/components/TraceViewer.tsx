import { useState, useEffect, useRef } from 'react'
import { useSession } from '../hooks/useSessions'
import { TurnCard } from './TurnCard'
import { TraceTimeline } from './TraceTimeline'
import { SourceBadge, getSourceConfig } from './SourceBadge'
import { SourceIcon } from './SourceIcon'
import { exportAsJSON, exportAsMarkdown, exportAsHTML } from '../utils/exportTrace'
import type { SessionMeta } from '@shared/types'

function shortPath(p = '') {
  return p.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')
}

export function TraceViewer({ meta }: { meta: SessionMeta }) {
  const { session, loading, error } = useSession(meta)
  const config = getSourceConfig(meta.source)
  const totalTools = session?.turns.reduce((n, t) => n + t.steps.filter(s => s.type === 'tool_use').length, 0) ?? 0
  const [exportOpen, setExportOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>(() => {
    if (typeof window === 'undefined') return 'timeline'
    return localStorage.getItem('trace-view-mode') === 'cards' ? 'cards' : 'timeline'
  })
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

  useEffect(() => {
    localStorage.setItem('trace-view-mode', viewMode)
  }, [viewMode])

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Premium Header */}
      <header className="flex-shrink-0 z-20 bg-surface-1/70 backdrop-blur-2xl border-b border-border-2 px-5 py-6 shadow-sm sm:px-8 lg:px-10">
        <div className="max-w-6xl mx-auto flex flex-col items-stretch justify-between gap-6 lg:flex-row lg:items-start">
          <div className="flex items-start gap-6 min-w-0">
            {/* Source Icon with Premium Glow */}
            <div className="relative group flex-shrink-0">
              <div 
                className="absolute -inset-1 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" 
                style={{ backgroundColor: config.color }} 
              />
              <div 
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center border-2 shadow-premium transition-all duration-500 group-hover:scale-105 group-hover:rotate-3"
                style={{ 
                  backgroundColor: 'var(--bg-0)',
                  borderColor: config.badgeBorder,
                  color: config.color 
                }}
              >
                <SourceIcon source={meta.source} className="w-9 h-9" />
              </div>
            </div>

            <div className="min-w-0 space-y-2.5">
              <div className="flex items-center gap-3 flex-wrap">
                <SourceBadge source={meta.source} />
                {meta.model && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-surface-3 text-text-2 border border-border-1 uppercase tracking-widest shadow-sm">
                    {meta.model.split('/').pop()?.split(':')[0]}
                  </span>
                )}
                <span className="text-[10px] font-mono text-text-4 select-all opacity-60 hover:opacity-100 transition-opacity cursor-help" title="Session ID">
                  {meta.id}
                </span>
              </div>
              
              <h2 className="text-2xl font-extrabold text-text-1 truncate tracking-tight font-sans">
                {shortPath(meta.cwd) || 'Root Directory'}
              </h2>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-3 font-bold uppercase tracking-widest sm:gap-4">
                <div className="flex items-center gap-1.5 whitespace-nowrap px-2 py-1 rounded-lg bg-surface-2 border border-border-1">
                  <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(meta.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap px-2 py-1 rounded-lg bg-surface-2 border border-border-1">
                  <span className="text-text-1">{meta.turnCount}</span> turns
                </div>
                {session && totalTools > 0 && (
                  <div className="flex items-center gap-1.5 whitespace-nowrap px-2 py-1 rounded-lg bg-surface-2 border border-border-1">
                    <span className="text-text-1">{totalTools}</span> tool calls
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <div className="flex items-center rounded-xl border border-border-2 bg-surface-2 p-1 shadow-sm">
              <button
                type="button"
                title="Show message cards"
                onClick={() => setViewMode('cards')}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                  viewMode === 'cards'
                    ? 'bg-surface-0 text-text-1 shadow-sm'
                    : 'text-text-3 hover:text-text-1'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                title="Show linear trace timeline"
                onClick={() => setViewMode('timeline')}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                  viewMode === 'timeline'
                    ? 'bg-surface-0 text-text-1 shadow-sm'
                    : 'text-text-3 hover:text-text-1'
                }`}
              >
                Timeline
              </button>
            </div>
            <div className="relative" ref={exportRef}>
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 border border-border-2 text-text-2 font-bold text-xs hover:bg-surface-3 hover:text-text-1 transition-all active:scale-95 shadow-sm"
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
      <div className={`flex-1 bg-surface-0 ${
        viewMode === 'timeline'
          ? 'overflow-hidden p-3 sm:p-6'
          : 'overflow-y-auto custom-scrollbar px-5 sm:px-10'
      }`}>
        <div className={viewMode === 'timeline' ? 'h-full' : 'max-w-5xl mx-auto py-12 pb-40'}>
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
            <div className={viewMode === 'timeline' ? 'h-full animate-slide-up' : 'space-y-16 animate-slide-up'}>
              {session.turns.length === 0 ? (
                <div className="text-center py-32 text-text-4 bg-surface-1 rounded-[40px] border-2 border-dashed border-border-2 transition-all hover:bg-surface-2 hover:border-border-3 group">
                  <div className="text-6xl mb-6 grayscale opacity-20 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700">📭</div>
                  <h3 className="text-xl font-extrabold text-text-2 mb-2 tracking-tight">Empty Session</h3>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">This session contains no trace data.</p>
                </div>
              ) : (
                viewMode === 'timeline'
                  ? <TraceTimeline session={session} />
                  : session.turns.map((turn, i) => (
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
