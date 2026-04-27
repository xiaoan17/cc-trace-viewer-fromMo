import { useEffect, useMemo, useRef, useState } from 'react'
import type { TraceSession, TraceStep } from '@shared/types'

type TimelineEvent = {
  id: string
  turnIndex: number
  sequence: number
  kind: 'user' | TraceStep['type'] | 'assistant'
  title: string
  detail: string
  timestamp?: string
  callId?: string
  isError?: boolean
  tokens?: number
}

type Link = {
  id: string
  from: number
  to: number
  error: boolean
}

const KIND_LABEL: Record<TimelineEvent['kind'], string> = {
  user: 'USER',
  assistant: 'ASSISTANT',
  tool_use: 'CALL',
  tool_result: 'RESULT',
  thinking: 'THINK',
  text: 'TEXT',
  system: 'SYSTEM',
}

export function TraceTimeline({ session }: { session: TraceSession }) {
  const { events, links, stats } = useMemo(() => buildTimeline(session), [session])
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? '')
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>())
  const scrollerRef = useRef<HTMLDivElement>(null)
  const selected = events.find((event) => event.id === selectedId) ?? events[0]
  const firstTs = firstTimestamp(events) || session.startedAt
  const width = Math.max(980, events.length * 168)

  useEffect(() => {
    setSelectedId(events[0]?.id ?? '')
  }, [session.id, events])

  useEffect(() => {
    const node = nodeRefs.current.get(selectedId)
    const scroller = scrollerRef.current
    if (!node || !scroller) return

    const left = node.offsetLeft - (scroller.clientWidth / 2) + (node.clientWidth / 2)
    scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [selectedId])

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-border-2 bg-surface-1 p-10 text-center text-sm font-bold text-text-3">
        No timeline events available.
      </div>
    )
  }

  return (
    <div className="trace-timeline-shell overflow-y-auto xl:overflow-hidden animate-slide-up">
      <div className="flex flex-col gap-4 border-b border-border-2 bg-surface-1/80 px-6 py-5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-text-4">
            Linear Trace Timeline
          </div>
          <h3 className="mt-1 truncate text-lg font-extrabold tracking-tight text-text-1">
            {session.turns.length} turns · {stats.tools} tool calls · {events.length} nodes
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LegendItem className="timeline-kind-user" label="User" />
            <LegendItem className="timeline-kind-agent" label="Assistant" />
            <LegendItem className="timeline-kind-tool" label="Tool" />
            <LegendItem className="timeline-kind-thinking" label="Reasoning" />
            <LegendItem className="timeline-kind-error" label="Error" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <StatPill label="tokens" value={stats.tokens ? compactNumber(stats.tokens) : 'n/a'} />
          <StatPill label="errors" value={String(stats.errors)} tone={stats.errors ? 'error' : 'success'} />
          <StatPill label="links" value={String(links.length)} />
          <StatPill label="span" value={formatSpan(events)} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-1">
        <div
          ref={scrollerRef}
          className="h-[420px] min-h-[420px] min-w-0 overflow-auto custom-scrollbar xl:h-auto xl:min-h-0"
          style={{
            background:
              'radial-gradient(circle at 30% 10%, rgba(59,130,246,0.10), transparent 28%), radial-gradient(circle at 70% 80%, rgba(16,185,129,0.10), transparent 26%)',
          }}
        >
          <div className="relative h-full min-h-[420px] p-8" style={{ width }}>
            <div className="absolute left-10 right-10 top-1/2 h-px bg-border-3" />
            <div className="absolute left-10 right-10 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-accent-user via-accent-tool to-accent-agent opacity-40" />
            <LinkLayer links={links} total={events.length} />

            <div
              className="relative grid h-full"
              style={{ gridTemplateColumns: `repeat(${events.length}, minmax(144px, 1fr))` }}
            >
              {events.map((event, index) => {
                const selectedEvent = event.id === selected?.id
                const above = index % 2 === 0

                return (
                  <button
                    key={event.id}
                    type="button"
                    ref={(node) => {
                      if (node) nodeRefs.current.set(event.id, node)
                      else nodeRefs.current.delete(event.id)
                    }}
                    onClick={() => setSelectedId(event.id)}
                    aria-pressed={selectedEvent}
                    className="relative h-full text-left focus:outline-none"
                    aria-label={`${KIND_LABEL[event.kind]} ${event.title}`}
                  >
                    <div className={`absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 ${above ? '' : 'flex-col-reverse'}`}>
                      <div className={`h-10 w-px ${above ? 'bg-gradient-to-t' : 'bg-gradient-to-b'} from-border-3 to-transparent`} />
                      <div className={`timeline-dot ${selectedEvent ? 'timeline-dot-selected' : ''} ${event.isError ? 'timeline-dot-error' : ''}`} />
                    </div>

                    <div className={`timeline-node ${selectedEvent ? 'timeline-node-selected' : ''} ${event.isError ? 'timeline-node-error' : ''} ${above ? 'top-0' : 'bottom-0'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`timeline-kind ${kindTone(event.kind, event.isError)}`}>
                          {KIND_LABEL[event.kind]}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-text-4">
                          {formatTime(event.timestamp, firstTs, event.sequence)}
                        </span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-[13px] font-extrabold leading-snug text-text-1">
                        {event.title}
                      </div>
                      <div className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-text-3">
                        {event.detail || 'No detail captured.'}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-1 pt-2">
                        <span className="font-mono text-[10px] text-text-4">#{event.turnIndex + 1}</span>
                        {event.callId && (
                          <span className="max-w-[88px] truncate rounded-md border border-accent-tool-border bg-accent-tool-bg px-1.5 py-0.5 font-mono text-[9px] text-accent-tool">
                            {event.callId}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="border-t border-border-2 bg-surface-1/90 p-5 xl:border-l xl:border-t-0">
          {selected && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className={`timeline-kind ${kindTone(selected.kind, selected.isError)}`}>
                    {KIND_LABEL[selected.kind]}
                  </span>
                  <span className="font-mono text-[11px] text-text-4">
                    {formatTime(selected.timestamp, firstTs, selected.sequence)}
                  </span>
                </div>
                <h4 className="mt-3 text-base font-extrabold leading-snug text-text-1">
                  {selected.title}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <MetaBox label="turn" value={`#${selected.turnIndex + 1}`} />
                <MetaBox label="node" value={String(selected.sequence + 1)} />
                {selected.timestamp && <MetaBox label="at" value={formatAbsoluteTime(selected.timestamp)} wide />}
                {selected.callId && <MetaBox label="call id" value={selected.callId} wide />}
                {selected.tokens ? <MetaBox label="tokens" value={compactNumber(selected.tokens)} /> : null}
              </div>

              <div className="rounded-xl border border-border-2 bg-surface-0 p-4">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-text-4">
                  Trace Detail
                </div>
                <pre className="max-h-[300px] whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-text-2 custom-scrollbar">
                  {selected.detail || 'No detail captured.'}
                </pre>
              </div>

              {selected.callId && (
                <button
                  type="button"
                  className="w-full rounded-xl border border-accent-tool-border bg-accent-tool-bg px-4 py-3 text-left text-xs font-bold text-accent-tool transition hover:border-accent-tool"
                  onClick={() => {
                    const related = events.find((event) =>
                      event.callId === selected.callId &&
                      event.id !== selected.id &&
                      (event.kind === 'tool_use' || event.kind === 'tool_result')
                    )
                    if (related) setSelectedId(related.id)
                  }}
                >
                  Jump to linked {selected.kind === 'tool_use' ? 'result' : 'call'}
                </button>
              )}

              <div className="rounded-xl border border-border-2 bg-surface-0 p-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-text-4">
                  Nearby Nodes
                </div>
                <div className="space-y-1">
                  {nearbyEvents(events, selected).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedId(event.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition ${
                        event.id === selected.id ? 'bg-surface-2 text-text-1' : 'text-text-3 hover:bg-surface-2 hover:text-text-1'
                      }`}
                    >
                      <span className={`timeline-kind shrink-0 ${kindTone(event.kind, event.isError)}`}>
                        {KIND_LABEL[event.kind]}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-bold">{event.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className={`timeline-kind ${className}`}>
      {label}
    </span>
  )
}

function buildTimeline(session: TraceSession) {
  const events: TimelineEvent[] = []
  let sequence = 0

  session.turns.forEach((turn, turnIndex) => {
    events.push({
      id: `${turn.id}-user`,
      turnIndex,
      sequence: sequence++,
      kind: 'user',
      title: firstLine(turn.userMessage) || 'User prompt',
      detail: turn.userMessage,
      timestamp: turn.startedAt,
    })

    turn.steps.forEach((step) => {
      const event = stepToEvent(step, turnIndex, sequence++)
      events.push(event)
    })

    if (turn.assistantMessage) {
      events.push({
        id: `${turn.id}-assistant`,
        turnIndex,
        sequence: sequence++,
        kind: 'assistant',
        title: firstLine(turn.assistantMessage) || 'Assistant response',
        detail: turn.assistantMessage,
        timestamp: turn.completedAt,
        tokens: turn.tokenUsage?.total,
      })
    }
  })

  const links = buildLinks(events)
  const stats = {
    tools: events.filter((event) => event.kind === 'tool_use').length,
    errors: events.filter((event) => event.isError).length,
    tokens: session.turns.reduce((sum, turn) => sum + (turn.tokenUsage?.total ?? 0), 0),
  }

  return { events, links, stats }
}

function stepToEvent(step: TraceStep, turnIndex: number, sequence: number): TimelineEvent {
  const title = stepTitle(step)
  return {
    id: step.id,
    turnIndex,
    sequence,
    kind: step.type,
    title,
    detail: stepDetail(step),
    timestamp: step.timestamp,
    callId: step.callId,
    isError: step.isError,
  }
}

function buildLinks(events: TimelineEvent[]): Link[] {
  const calls = new Map<string, number>()
  const links: Link[] = []

  events.forEach((event, index) => {
    if (!event.callId) return
    if (event.kind === 'tool_use') {
      calls.set(event.callId, index)
      return
    }
    if (event.kind !== 'tool_result') return
    const from = calls.get(event.callId)
    if (from === undefined) return
    links.push({ id: `${event.callId}-${index}`, from, to: index, error: event.isError === true })
  })

  return links
}

function LinkLayer({ links, total }: { links: Link[]; total: number }) {
  if (links.length === 0 || total < 2) return null

  return (
    <svg className="pointer-events-none absolute inset-8 z-0 h-[calc(100%-4rem)] w-[calc(100%-4rem)] overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
      {links.map((link, index) => {
        const x1 = ((link.from + 0.5) / total) * 100
        const x2 = ((link.to + 0.5) / total) * 100
        const arc = index % 2 === 0 ? 32 : 68
        const color = link.error ? 'var(--accent-error)' : 'var(--accent-tool)'
        return (
          <path
            key={link.id}
            d={`M ${x1} 50 C ${(x1 + x2) / 2} ${arc}, ${(x1 + x2) / 2} ${arc}, ${x2} 50`}
            fill="none"
            stroke={color}
            strokeWidth="0.35"
            strokeDasharray="1.2 1.1"
            opacity="0.55"
          />
        )
      })}
    </svg>
  )
}

function StatPill({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'error' }) {
  const toneClass = tone === 'error'
    ? 'text-accent-error border-accent-error-border bg-accent-error-bg'
    : tone === 'success'
      ? 'text-accent-success border-accent-success-border bg-accent-success-bg'
      : 'text-text-2 border-border-2 bg-surface-2'

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="font-mono text-sm font-black leading-none">{value}</div>
      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] opacity-60">{label}</div>
    </div>
  )
}

function MetaBox({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-border-2 bg-surface-0 p-3 ${wide ? 'col-span-2' : ''}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-text-4">{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-bold text-text-2" title={value}>{value}</div>
    </div>
  )
}

function stepTitle(step: TraceStep): string {
  if (step.type === 'tool_use') return step.name || 'Tool call'
  if (step.type === 'tool_result') return step.isError ? 'Tool error' : 'Tool result'
  if (step.type === 'thinking') return 'Reasoning'
  if (step.type === 'system') return step.name || 'System event'
  if (step.type === 'text') return firstLine(step.text || '') || 'Assistant text'
  return 'Trace event'
}

function stepDetail(step: TraceStep): string {
  if (step.type === 'tool_use') {
    const preview = previewInput(step.name || '', step.input)
    const input = step.input ? JSON.stringify(step.input, null, 2) : ''
    return [preview, input].filter(Boolean).join('\n\n')
  }
  if (step.type === 'tool_result') return step.output || ''
  return step.text || ''
}

function previewInput(name: string, input?: Record<string, unknown>): string {
  if (!input) return ''
  const s = (key: string) => input[key] as string | undefined
  if (/bash|shell|exec|command/i.test(name)) return clip(s('command') || s('cmd') || '')
  if (/read|write|edit|glob/i.test(name)) return s('file_path') || s('path') || s('pattern') || ''
  if (/grep|search/i.test(name)) return s('pattern') ? `/${s('pattern')}/` : ''
  for (const value of Object.values(input)) {
    if (typeof value === 'string' && value.length > 0) return clip(value)
  }
  return ''
}

function kindTone(kind: TimelineEvent['kind'], isError?: boolean) {
  if (isError) return 'timeline-kind-error'
  if (kind === 'user') return 'timeline-kind-user'
  if (kind === 'assistant' || kind === 'text') return 'timeline-kind-agent'
  if (kind === 'tool_use' || kind === 'tool_result') return 'timeline-kind-tool'
  if (kind === 'thinking') return 'timeline-kind-thinking'
  return 'timeline-kind-system'
}

function firstTimestamp(events: TimelineEvent[]) {
  return events.find((event) => event.timestamp)?.timestamp
}

function formatTime(timestamp: string | undefined, first: string | undefined, fallback: number) {
  const current = timestamp ? new Date(timestamp).getTime() : Number.NaN
  const start = first ? new Date(first).getTime() : Number.NaN
  if (Number.isFinite(current) && Number.isFinite(start)) {
    const seconds = Math.max(0, Math.round((current - start) / 1000))
    if (seconds < 60) return `+${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `+${minutes}m ${seconds % 60}s`
  }
  return `#${fallback + 1}`
}

function formatAbsoluteTime(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatSpan(events: TimelineEvent[]) {
  const times = events
    .map((event) => event.timestamp ? new Date(event.timestamp).getTime() : Number.NaN)
    .filter(Number.isFinite)
  if (times.length < 2) return 'order'
  const span = Math.max(...times) - Math.min(...times)
  const seconds = Math.round(span / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m`
}

function firstLine(text: string) {
  return clip(text.trim().split(/\r?\n/).find(Boolean) || '', 72)
}

function clip(text: string, n = 96) {
  return text.length > n ? `${text.slice(0, n)}...` : text
}

function compactNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function nearbyEvents(events: TimelineEvent[], selected: TimelineEvent) {
  const start = Math.max(0, selected.sequence - 2)
  const end = Math.min(events.length, selected.sequence + 3)
  return events.slice(start, end)
}
