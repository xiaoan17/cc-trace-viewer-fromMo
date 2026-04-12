import { useState } from 'react'
import type { TraceTurn } from '@shared/types'
import { StepItem, ToolPairItem } from './StepItem'
import { Markdown } from './Markdown'
import { RoleAvatar } from './RoleAvatar'

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
      <div className="absolute -left-14 top-0 h-full flex flex-col items-center group-hover/turn:opacity-100 opacity-20 transition-all duration-500">
        <div className="text-[10px] font-mono font-black text-text-4 bg-surface-2 w-8 h-8 rounded-full flex items-center justify-center border-2 border-border-1 shadow-sm group-hover/turn:scale-110 group-hover/turn:text-text-2 group-hover/turn:border-border-2 transition-all">
          {index + 1}
        </div>
        <div className="flex-1 w-0.5 bg-gradient-to-b from-border-2 to-transparent my-3 rounded-full" />
      </div>

      <div className="space-y-8">
        {/* ─── User Message ─── */}
        <div className="flex flex-col items-end">
          <div className="max-w-[85%] min-w-0">
            <div className="flex items-center justify-end gap-3 mb-2.5 px-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-3 opacity-90">
                User
              </span>
              <RoleAvatar role="user" className="w-11 h-11" />
            </div>
            <div className="message-bubble message-bubble-user prose-custom rounded-[28px] rounded-tr-lg px-6 py-5">
              <Markdown>{turn.userMessage}</Markdown>
            </div>
          </div>
        </div>

        {/* ─── Agent Response ─── */}
        <div className="flex flex-col items-start">
          <div className="w-full max-w-[95%] min-w-0 space-y-5">
            <div className="flex items-center gap-3 mb-2.5 px-2">
              <RoleAvatar role="assistant" className="w-11 h-11" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-3 opacity-90 mr-4">
                Assistant
              </span>
              {turn.tokenUsage && (
                <div className="flex items-center gap-2 overflow-hidden py-1">
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
                  className={`flex items-center gap-3 mb-4 group/btn px-4 py-2 rounded-xl border transition-all duration-300 ${
                    stepsOpen 
                      ? 'bg-accent-tool-bg border-accent-tool-border text-accent-tool shadow-md' 
                      : 'bg-surface-2 border-border-2 text-text-3 hover:bg-surface-3 hover:border-border-3 shadow-sm'
                  }`}
                >
                  <div className={`transition-transform duration-300 ${stepsOpen ? 'rotate-90' : ''}`}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.15em] leading-none">
                    {stepsLabel}
                  </span>
                </button>

                {stepsOpen && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-3 duration-500 fill-mode-forwards">
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
              <div className="message-bubble message-bubble-assistant prose-custom rounded-[28px] rounded-tl-lg px-7 py-6">
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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`rounded-lg bg-accent-user/15 flex items-center justify-center border border-accent-user/30 shadow-sm ${className}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 8c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z"
        fill="currentColor"
      />
    </svg>
  )
}

function AssistantIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`rounded-lg bg-accent-agent/15 flex items-center justify-center border border-accent-agent/30 shadow-sm ${className}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 0H4C1.79 0 0 1.79 0 4v8c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V4c0-2.21-1.79-4-4-4Zm-4 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2Zm-3-5c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h.5c.28 0 .5.22.5.5v2.5c0 .28-.22.5-.5.5H5Zm6 0c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h.5c.28 0 .5.22.5.5v2.5c0 .28-.22.5-.5.5h-.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

function Token({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span
      className={`text-[9px] font-mono font-black px-2 py-1 rounded-md border leading-none transition-all duration-300 ${
        highlight 
          ? 'bg-accent-thinking-bg border-accent-thinking-border text-accent-thinking shadow-[0_0_12px_rgba(245,158,11,0.2)] scale-105 mx-1' 
          : 'bg-surface-1 border-border-2 text-text-3'
      }`}
    >
      {label}
    </span>
  )
}
