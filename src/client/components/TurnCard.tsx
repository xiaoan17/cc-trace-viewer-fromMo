import { useState } from 'react'
import type { TraceTurn } from '@shared/types'
import { StepItem } from './StepItem'
import { Markdown } from './Markdown'

export function TurnCard({ turn, index }: { turn: TraceTurn; index: number }) {
  const [stepsOpen, setStepsOpen] = useState(true)
  const toolCount = turn.steps.filter(s => s.type === 'tool_use').length

  return (
    <div className="relative mb-8">
      {/* Timeline spine */}
      <div
        className="absolute left-[15px] top-8 bottom-0 w-px"
        style={{ background: 'linear-gradient(to bottom, var(--border-2) 60%, transparent)' }}
      />

      {/* Turn badge */}
      <div
        className="absolute left-2.5 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
        style={{ background: 'var(--bg-3)', border: '1.5px solid var(--border-2)', color: 'var(--text-4)' }}
      >
        {index + 1}
      </div>

      <div className="pl-11 space-y-3">

        {/* ─────────────────── USER ─────────────────── */}
        <MessageBlock
          label="User"
          icon={
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 0 0 3px rgba(99,102,241,0.15)' }}>
              U
            </div>
          }
          accentColor="#4f46e5"
          borderColor="rgba(99,102,241,0.22)"
          bgGradient="linear-gradient(135deg,rgba(79,70,229,0.07) 0%,rgba(99,102,241,0.03) 100%)"
        >
          <Markdown>{turn.userMessage}</Markdown>
        </MessageBlock>

        {/* ─────────────────── STEPS (tool calls) ─────────────────── */}
        {turn.steps.length > 0 && (
          <div>
            {/* Section header */}
            <button
              onClick={() => setStepsOpen(x => !x)}
              className="flex items-center gap-2 w-full mb-2 group"
            >
              <div
                className="h-px flex-1 transition-colors"
                style={{ background: stepsOpen ? 'rgba(2,132,199,0.3)' : 'var(--border-1)' }}
              />
              <span
                className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all"
                style={{
                  background: stepsOpen ? 'rgba(2,132,199,0.08)' : 'var(--bg-2)',
                  border: `1px solid ${stepsOpen ? 'rgba(2,132,199,0.25)' : 'var(--border-1)'}`,
                  color: stepsOpen ? '#0284c7' : 'var(--text-4)',
                }}
              >
                <svg className="w-2.5 h-2.5" style={{ transform: stepsOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {toolCount > 0 ? `${toolCount} tool call${toolCount > 1 ? 's' : ''}` : `${turn.steps.length} steps`}
              </span>
              <div
                className="h-px flex-1 transition-colors"
                style={{ background: stepsOpen ? 'rgba(2,132,199,0.3)' : 'var(--border-1)' }}
              />
            </button>

            {stepsOpen && (
              <div className="space-y-1.5">
                {turn.steps.map(step => (
                  <StepItem key={step.id} step={step} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────── ASSISTANT ─────────────────── */}
        {turn.assistantMessage && (
          <MessageBlock
            label="Assistant"
            icon={
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: '0 0 0 3px rgba(16,185,129,0.15)' }}>
                A
              </div>
            }
            accentColor="#059669"
            borderColor="rgba(16,185,129,0.2)"
            bgGradient="var(--bg-1)"
            extra={turn.tokenUsage && (
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                <Token label={`↑ ${turn.tokenUsage.input.toLocaleString()}`} />
                <Token label={`↓ ${turn.tokenUsage.output.toLocaleString()}`} />
                {turn.tokenUsage.cached ? (
                  <Token label={`⚡ ${turn.tokenUsage.cached.toLocaleString()}`} highlight />
                ) : null}
              </div>
            )}
          >
            <Markdown>{turn.assistantMessage}</Markdown>
          </MessageBlock>
        )}

      </div>
    </div>
  )
}

/* ── Shared block wrapper ── */
function MessageBlock({
  label, icon, accentColor, borderColor, bgGradient, extra, children,
}: {
  label: string
  icon: React.ReactNode
  accentColor: string
  borderColor: string
  bgGradient: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${borderColor}` }}>
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{
          background: bgGradient,
          borderColor,
        }}
      >
        {icon}
        <span
          className="text-xs font-black uppercase tracking-widest"
          style={{ color: accentColor }}
        >
          {label}
        </span>
        {extra}
      </div>
      {/* Body */}
      <div className="px-5 py-4" style={{ background: bgGradient }}>
        {children}
      </div>
    </div>
  )
}

function Token({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span
      className="text-[11px] font-mono px-2 py-0.5 rounded-md"
      style={{
        background: highlight ? 'rgba(180,83,9,0.08)' : 'var(--bg-3)',
        border: `1px solid ${highlight ? 'rgba(180,83,9,0.2)' : 'var(--border-1)'}`,
        color: highlight ? '#b45309' : 'var(--text-3)',
      }}
    >
      {label}
    </span>
  )
}
