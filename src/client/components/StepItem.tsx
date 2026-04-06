import { useState } from 'react'
import type { TraceStep } from '@shared/types'
import { Markdown } from './Markdown'

/* ════════════════════════════════════════════
   Step type color system
   thinking  → amber / muted
   tool_use  → sky / blue
   tool_result (ok)  → emerald
   tool_result (err) → red
═══════════════════════════════════════════ */

export function StepItem({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false)

  /* ── Thinking ────────────────────────────── */
  if (step.type === 'thinking') {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: '1.5px dashed rgba(180,83,9,0.25)',
          background: 'rgba(254,243,199,0.4)',
        }}
      >
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-2.5 w-full text-left px-4 py-2.5"
        >
          {/* Icon */}
          <span className="text-base flex-shrink-0">💭</span>
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#92400e' }}>
            Thinking
          </span>
          {!open && step.text && (
            <span className="text-xs truncate flex-1 italic" style={{ color: '#b45309' }}>
              {step.text.slice(0, 100)}…
            </span>
          )}
          <Chevron open={open} color="#b45309" />
        </button>
        {open && (
          <div
            className="px-4 pb-3.5 pt-0 text-sm italic leading-relaxed"
            style={{ color: '#92400e', borderTop: '1px dashed rgba(180,83,9,0.2)' }}
          >
            <Markdown>{step.text ?? ''}</Markdown>
          </div>
        )}
      </div>
    )
  }

  /* ── Tool Use ─────────────────────────────── */
  if (step.type === 'tool_use') {
    const preview = getPreview(step.name || '', step.input)
    const inputStr = step.input ? JSON.stringify(step.input, null, 2) : ''

    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: `1.5px solid ${open ? 'rgba(2,132,199,0.35)' : 'rgba(2,132,199,0.18)'}`,
          background: open ? 'rgba(240,249,255,0.8)' : 'rgba(240,249,255,0.5)',
        }}
      >
        {/* Header */}
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-2.5 w-full text-left px-4 py-2.5"
        >
          <span className="text-base flex-shrink-0">⚙️</span>
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#0369a1' }}>
            Tool Call
          </span>
          <code
            className="text-sm font-mono font-semibold px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(2,132,199,0.1)', color: '#0284c7' }}
          >
            {step.name}
          </code>
          {!open && preview && (
            <span className="text-sm font-mono truncate flex-1" style={{ color: '#0369a1', opacity: 0.7 }}>
              {preview}
            </span>
          )}
          <Chevron open={open} color="#0369a1" />
        </button>

        {/* Input body */}
        {open && inputStr && (
          <div style={{ borderTop: '1.5px solid rgba(2,132,199,0.18)' }}>
            <div
              className="flex items-center gap-2 px-4 py-1.5"
              style={{ background: 'rgba(2,132,199,0.06)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#0369a1' }}>
                Input
              </span>
              <span className="text-[10px] font-mono ml-auto" style={{ color: '#7dd3fc' }}>
                json
              </span>
            </div>
            <pre
              className="px-4 py-3 text-sm font-mono leading-relaxed overflow-x-auto"
              style={{
                background: '#f0f9ff',
                color: '#0c4a6e',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {inputStr.length > 4000 ? inputStr.slice(0, 4000) + '\n… (truncated)' : inputStr}
            </pre>
          </div>
        )}
      </div>
    )
  }

  /* ── Tool Result ──────────────────────────── */
  if (step.type === 'tool_result') {
    const isErr = step.isError
    const out = step.output || ''
    const isLong = out.length > 600
    const shown = !open && isLong ? out.slice(0, 600) : out

    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: `1.5px solid ${isErr ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.25)'}`,
          background: isErr ? 'rgba(254,242,242,0.6)' : 'rgba(240,253,244,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-4 py-2.5"
          style={{
            background: isErr ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.06)',
            borderBottom: `1.5px solid ${isErr ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)'}`,
          }}
        >
          <span className="text-base flex-shrink-0">{isErr ? '❌' : '✅'}</span>
          <span
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: isErr ? '#b91c1c' : '#15803d' }}
          >
            {isErr ? 'Error' : 'Result'}
          </span>
          <span
            className="ml-auto text-xs font-mono px-2 py-0.5 rounded-md"
            style={{
              background: isErr ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
              border: `1px solid ${isErr ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)'}`,
              color: isErr ? '#dc2626' : '#16a34a',
            }}
          >
            {out.length.toLocaleString()} chars
          </span>
        </div>

        {/* Output */}
        <pre
          className="px-4 py-3 text-sm font-mono leading-relaxed overflow-x-auto"
          style={{
            background: isErr ? '#fef2f2' : '#f0fdf4',
            color: isErr ? '#991b1b' : '#14532d',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: open ? 'none' : '160px',
            overflow: open ? 'visible' : 'hidden',
          }}
        >
          {shown || '(empty)'}
        </pre>

        {isLong && (
          <button
            onClick={() => setOpen(x => !x)}
            className="w-full px-4 py-2 text-xs font-semibold text-left transition-colors"
            style={{
              background: isErr ? 'rgba(220,38,38,0.04)' : 'rgba(22,163,74,0.04)',
              borderTop: `1px solid ${isErr ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)'}`,
              color: isErr ? '#dc2626' : '#16a34a',
            }}
          >
            {open ? '▲ Collapse output' : `▼ Show all ${out.length.toLocaleString()} chars`}
          </button>
        )}
      </div>
    )
  }

  return null
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <svg
      className="w-3.5 h-3.5 flex-shrink-0 ml-auto transition-transform duration-150"
      style={{ transform: open ? 'rotate(90deg)' : 'none', color }}
      viewBox="0 0 16 16" fill="none"
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getPreview(name: string, input?: Record<string, unknown>): string {
  if (!input) return ''
  const s = (k: string) => input[k] as string | undefined
  if (/bash/i.test(name)) return clip(s('command') || '')
  if (/read|write|edit|glob/i.test(name)) return s('file_path') || s('path') || s('pattern') || ''
  if (/grep/i.test(name)) return s('pattern') ? `/${s('pattern')}/` : ''
  for (const v of Object.values(input)) {
    if (typeof v === 'string' && v.length) return clip(v)
  }
  return ''
}

function clip(s: string, n = 72) { return s.length > n ? s.slice(0, n) + '…' : s }
