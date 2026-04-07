import { useState } from 'react'
import type { TraceTurn } from '@shared/types'
import { StepItem, ToolPairItem } from './StepItem'
import { Markdown } from './Markdown'

type RenderedStep =
  | { kind: 'single'; step: TraceTurn['steps'][number] }
  | { kind: 'tool'; key: string; toolUse: TraceTurn['steps'][number]; toolResult?: TraceTurn['steps'][number] }

export function TurnCard({ turn, index }: { turn: TraceTurn; index: number }) {
  const [stepsOpen, setStepsOpen] = useState(true)
  const toolCount = turn.steps.filter(s => s.type === 'tool_use').length
  const hasMixedEvents = turn.steps.some(s => s.type === 'text' || s.type === 'thinking' || s.type === 'system')
  const stepsLabel = toolCount > 0 && !hasMixedEvents
    ? `${toolCount} tool call${toolCount > 1 ? 's' : ''}`
    : `${turn.steps.length} event${turn.steps.length > 1 ? 's' : ''}`
  const renderedSteps = groupSteps(turn.steps)

  return (
    <div className="mb-8">

      {/* ─── Right: User message ─── */}
      <div className="flex justify-end mb-4">
        <div className="flex items-start gap-2.5 w-full max-w-[78%]">
          <div className="flex-1 min-w-0">
            <div className="flex justify-end mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-user)' }}>
                User · #{index + 1}
              </span>
            </div>
            <div
              className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
              style={{
                background: 'linear-gradient(135deg, var(--accent-user-bg) 0%, rgba(124, 114, 232, 0.06) 100%)',
                border: '1.5px solid var(--accent-user-border)',
                color: 'var(--text-1)',
              }}
            >
              <Markdown>{turn.userMessage}</Markdown>
            </div>
          </div>
          {/* Avatar */}
          <div
            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-black text-white mt-6"
            style={{ background: 'linear-gradient(135deg, var(--accent-user), var(--accent-user-2))', boxShadow: '0 0 0 3px rgba(91, 91, 214, 0.12)' }}
          >
            U
          </div>
        </div>
      </div>

      {/* ─── Left: Agent (steps + assistant reply) ─── */}
      <div className="flex justify-start">
        <div className="flex items-start gap-2.5 w-full max-w-[88%]">
          {/* Avatar */}
          <div
            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-black text-white mt-0"
            style={{ background: 'linear-gradient(135deg, var(--accent-agent), var(--accent-agent-2))', boxShadow: '0 0 0 3px rgba(15, 140, 114, 0.12)' }}
          >
            A
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-agent)' }}>
                Agent
              </span>
              {turn.tokenUsage && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Token label={`↑ ${turn.tokenUsage.input.toLocaleString()}`} />
                  <Token label={`↓ ${turn.tokenUsage.output.toLocaleString()}`} />
                  {turn.tokenUsage.cached ? (
                    <Token label={`⚡ ${turn.tokenUsage.cached.toLocaleString()}`} highlight />
                  ) : null}
                </div>
              )}
            </div>

            {/* Steps / tool calls */}
            {turn.steps.length > 0 && (
              <div>
                <button
                  onClick={() => setStepsOpen(x => !x)}
                  className="flex items-center gap-2 mb-2 group"
                >
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all"
                    style={{
                      background: stepsOpen ? 'var(--accent-tool-bg)' : 'var(--bg-2)',
                      border: `1px solid ${stepsOpen ? 'var(--accent-tool-border)' : 'var(--border-1)'}`,
                      color: stepsOpen ? 'var(--accent-tool)' : 'var(--text-4)',
                    }}
                  >
                    <svg
                      className="w-2.5 h-2.5"
                      style={{ transform: stepsOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
                      viewBox="0 0 16 16" fill="none"
                    >
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {stepsLabel}
                  </span>
                </button>

                {stepsOpen && (
                  <div className="space-y-1.5 mb-2">
                    {renderedSteps.map((item) => (
                      item.kind === 'tool'
                        ? <ToolPairItem key={item.key} toolUse={item.toolUse} toolResult={item.toolResult} />
                        : <StepItem key={item.step.id} step={item.step} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Assistant reply bubble */}
            {turn.assistantMessage && !turn.steps.some(step => step.type === 'text') && (
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: 'var(--bg-2)',
                  border: '1.5px solid var(--accent-agent-border)',
                  color: 'var(--text-1)',
                }}
              >
                <Markdown>{turn.assistantMessage}</Markdown>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

function groupSteps(steps: TraceTurn['steps']) {
  const consumed = new Set<number>()
  const items: RenderedStep[] = []

  steps.forEach((step, index) => {
    if (consumed.has(index)) return

    if (step.type !== 'tool_use' || !step.callId) {
      items.push({ kind: 'single', step })
      return
    }

    const resultIndex = steps.findIndex((candidate, candidateIndex) => {
      return candidateIndex > index &&
        !consumed.has(candidateIndex) &&
        candidate.type === 'tool_result' &&
        candidate.callId === step.callId
    })

    if (resultIndex === -1) {
      items.push({ kind: 'tool', key: step.id, toolUse: step, toolResult: undefined })
      return
    }

    consumed.add(resultIndex)
    items.push({
      kind: 'tool',
      key: step.callId,
      toolUse: step,
      toolResult: steps[resultIndex],
    })
  })

  return items
}

function Token({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span
      className="text-[11px] font-mono px-2 py-0.5 rounded-md"
      style={{
        background: highlight ? 'var(--accent-thinking-bg)' : 'var(--bg-3)',
        border: `1px solid ${highlight ? 'var(--accent-thinking-border)' : 'var(--border-1)'}`,
        color: highlight ? 'var(--accent-thinking)' : 'var(--text-3)',
      }}
    >
      {label}
    </span>
  )
}
