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
    <div className="relative group/turn">
      {/* Turn Number Indicator */}
      <div className="absolute -left-12 top-0 h-full flex flex-col items-center group-hover/turn:opacity-100 opacity-40 transition-opacity">
        <div className="text-[10px] font-mono font-bold text-text-4 bg-surface-2 w-7 h-7 rounded-full flex items-center justify-center border border-border-1 shadow-sm">
          {index + 1}
        </div>
        <div className="flex-1 w-px bg-border-1 my-2" />
      </div>

      <div className="space-y-6">
        {/* ─── User Message ─── */}
        <div className="flex flex-col items-end">
          <div className="max-w-[85%] min-w-0">
            <div className="flex items-center justify-end gap-2 mb-2 px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-user opacity-80">
                User
              </span>
              <div className="w-5 h-5 rounded-md bg-accent-user/10 flex items-center justify-center text-[10px] font-bold text-accent-user border border-accent-user/20">
                U
              </div>
            </div>
            <div className="prose-custom rounded-2xl rounded-tr-sm px-5 py-4 text-sm bg-surface-1 border border-accent-user-border shadow-sm ring-1 ring-accent-user/5">
              <Markdown>{turn.userMessage}</Markdown>
            </div>
          </div>
        </div>

        {/* ─── Agent Response ─── */}
        <div className="flex flex-col items-start">
          <div className="w-full max-w-[92%] min-w-0 space-y-4">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-5 h-5 rounded-md bg-accent-agent/10 flex items-center justify-center text-[10px] font-bold text-accent-agent border border-accent-agent/20">
                A
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-agent opacity-80 mr-2">
                Assistant
              </span>
              {turn.tokenUsage && (
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Token label={`↑ ${turn.tokenUsage.input.toLocaleString()}`} />
                  <Token label={`↓ ${turn.tokenUsage.output.toLocaleString()}`} />
                  {turn.tokenUsage.cached ? (
                    <Token label={`⚡ ${turn.tokenUsage.cached.toLocaleString()}`} highlight />
                  ) : null}
                </div>
              )}
            </div>

            {/* Steps Section */}
            {turn.steps.length > 0 && (
              <div className="pl-1">
                <button
                  onClick={() => setStepsOpen(x => !x)}
                  className={`flex items-center gap-2.5 mb-3 group/btn px-3 py-1.5 rounded-full border transition-all ${
                    stepsOpen 
                      ? 'bg-accent-tool-bg border-accent-tool-border text-accent-tool shadow-sm' 
                      : 'bg-surface-2 border-border-1 text-text-3 hover:border-border-2'
                  }`}
                >
                  <svg
                    className={`w-3 h-3 transition-transform duration-200 ${stepsOpen ? 'rotate-90' : ''}`}
                    viewBox="0 0 16 16" fill="none"
                  >
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-widest leading-none">
                    {stepsLabel}
                  </span>
                </button>

                {stepsOpen && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
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
              <div className="prose-custom rounded-2xl rounded-tl-sm px-6 py-4 text-sm bg-surface-1 border border-accent-agent-border shadow-sm ring-1 ring-accent-agent/5">
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
      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border leading-none transition-colors ${
        highlight 
          ? 'bg-accent-thinking-bg border-accent-thinking-border text-accent-thinking shadow-[0_0_8px_rgba(217,119,6,0.1)]' 
          : 'bg-surface-2 border-border-1 text-text-4'
      }`}
    >
      {label}
    </span>
  )
}
