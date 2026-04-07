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

  if (step.type === 'text') {
    return (
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
        style={{
          background: 'var(--bg-2)',
          border: '1.5px solid var(--accent-agent-border)',
          color: 'var(--text-1)',
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent-agent)' }}>
          Assistant
        </div>
        <Markdown>{step.text ?? ''}</Markdown>
      </div>
    )
  }

  /* ── Thinking ────────────────────────────── */
  if (step.type === 'thinking') {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: '1.5px dashed var(--accent-thinking-border)',
          background: 'var(--accent-thinking-bg)',
        }}
      >
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-2.5 w-full text-left px-4 py-2.5"
        >
          <ThinkingIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--accent-thinking)' }}>
            Thinking
          </span>
          {!open && step.text && (
            <span className="text-xs truncate flex-1 italic" style={{ color: 'var(--accent-thinking)' }}>
              {step.text.slice(0, 100)}…
            </span>
          )}
          <Chevron open={open} color="var(--accent-thinking)" />
        </button>
        {open && (
          <div
            className="px-4 pb-3.5 pt-0 text-sm italic leading-relaxed"
            style={{ color: 'var(--accent-thinking)', borderTop: '1px dashed var(--accent-thinking-border)' }}
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
          border: `1.5px solid ${open ? 'var(--accent-tool-border)' : 'rgba(53, 109, 204, 0.16)'}`,
          background: open ? 'rgba(234, 241, 251, 0.88)' : 'rgba(234, 241, 251, 0.56)',
        }}
      >
        {/* Header */}
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-2.5 w-full text-left px-4 py-2.5"
        >
          <ToolIcon className="w-4 h-4 flex-shrink-0" color="var(--accent-tool)" />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--accent-tool-text)' }}>
            Tool Call
          </span>
          <code
            className="text-sm font-mono font-semibold px-2 py-0.5 rounded-md"
            style={{ background: 'var(--accent-tool-bg)', color: 'var(--accent-tool)' }}
          >
            {step.name}
          </code>
          {!open && preview && (
            <span className="text-sm font-mono truncate flex-1" style={{ color: 'var(--accent-tool-text)', opacity: 0.72 }}>
              {preview}
            </span>
          )}
          <Chevron open={open} color="var(--accent-tool)" />
        </button>

        {/* Input body */}
        {open && inputStr && (
          <div style={{ borderTop: '1.5px solid rgba(53, 109, 204, 0.16)' }}>
            <div
              className="flex items-center gap-2 px-4 py-1.5"
              style={{ background: 'var(--accent-tool-bg)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-tool-text)' }}>
                Input
              </span>
              <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--accent-tool)' }}>
                json
              </span>
            </div>
            <pre
              className="px-4 py-3 text-sm font-mono leading-relaxed overflow-x-auto"
              style={{
                background: 'var(--accent-tool-soft)',
                color: 'var(--accent-tool-text)',
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
          border: `1.5px solid ${isErr ? 'var(--accent-error-border)' : 'var(--accent-success-border)'}`,
          background: isErr ? 'var(--accent-error-bg)' : 'var(--accent-success-bg)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-4 py-2.5"
          style={{
            background: isErr ? 'var(--accent-error-bg)' : 'var(--accent-success-bg)',
            borderBottom: `1.5px solid ${isErr ? 'var(--accent-error-border)' : 'var(--accent-success-border)'}`,
          }}
        >
          {isErr ? (
            <ErrorIcon className="w-4 h-4 flex-shrink-0" />
          ) : (
            <SuccessIcon className="w-4 h-4 flex-shrink-0" />
          )}
          <span
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: isErr ? 'var(--accent-error)' : 'var(--accent-success)' }}
          >
            {isErr ? 'Error' : 'Result'}
          </span>
          <span
            className="ml-auto text-xs font-mono px-2 py-0.5 rounded-md"
            style={{
              background: isErr ? 'var(--accent-error-bg)' : 'var(--accent-success-bg)',
              border: `1px solid ${isErr ? 'var(--accent-error-border)' : 'var(--accent-success-border)'}`,
              color: isErr ? 'var(--accent-error)' : 'var(--accent-success)',
            }}
          >
            {out.length.toLocaleString()} chars
          </span>
        </div>

        {/* Output */}
        <pre
          className="px-4 py-3 text-sm font-mono leading-relaxed overflow-x-auto"
          style={{
            background: isErr ? 'var(--accent-error-soft)' : 'var(--accent-success-soft)',
            color: isErr ? 'var(--accent-error-text)' : 'var(--accent-success-text)',
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
              background: isErr ? 'var(--accent-error-bg)' : 'var(--accent-success-bg)',
              borderTop: `1px solid ${isErr ? 'var(--accent-error-border)' : 'var(--accent-success-border)'}`,
              color: isErr ? 'var(--accent-error)' : 'var(--accent-success)',
            }}
          >
            {open ? '▲ Collapse output' : `▼ Show all ${out.length.toLocaleString()} chars`}
          </button>
        )}
      </div>
    )
  }

  if (step.type === 'system') {
    const body = step.text || ''
    const isLong = body.length > 500
    const shown = !open && isLong ? body.slice(0, 500) + '…' : body
    const isTask = step.name?.startsWith('task') === true
    const isTaskError = isTask && step.isError === true
    const borderColor = isTask
      ? (isTaskError ? 'var(--accent-error-border)' : 'var(--accent-tool-border)')
      : 'var(--accent-system-border)'
    const backgroundColor = isTask
      ? (isTaskError ? 'var(--accent-error-bg)' : 'var(--accent-tool-bg)')
      : 'rgba(241, 244, 248, 0.72)'
    const textColor = isTask
      ? (isTaskError ? 'var(--accent-error)' : 'var(--accent-tool-text)')
      : 'var(--accent-system)'
    const badgeBackground = isTask
      ? (isTaskError ? 'var(--accent-error-bg)' : 'var(--accent-tool-bg)')
      : 'var(--accent-system-bg)'
    const badgeLabel = isTask ? 'Task' : 'System'
    const detailLabel = step.name?.replace(/^task_/, '')

    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: `1.5px solid ${borderColor}`,
          background: backgroundColor,
        }}
      >
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-2.5 w-full text-left px-4 py-2.5"
        >
          {isTask ? (
            <ToolIcon className="w-4 h-4 flex-shrink-0" color={isTaskError ? 'var(--accent-error)' : 'var(--accent-tool)'} />
          ) : (
            <InfoIcon className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: textColor }}>
            {badgeLabel}
          </span>
          {detailLabel && (
            <code
              className="text-xs font-mono px-2 py-0.5 rounded-md"
              style={{ background: badgeBackground, color: textColor }}
            >
              {detailLabel}
            </code>
          )}
          <Chevron open={open} color={textColor} />
        </button>
        {body && (
          <pre
            className="px-4 pb-3.5 pt-0 text-xs font-mono leading-relaxed overflow-x-auto"
            style={{
              color: textColor,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {shown}
          </pre>
        )}
      </div>
    )
  }

  return null
}

export function ToolPairItem({ toolUse, toolResult }: { toolUse: TraceStep; toolResult?: TraceStep }) {
  const [open, setOpen] = useState(false)
  const preview = getPreview(toolUse.name || '', toolUse.input)
  const inputStr = toolUse.input ? JSON.stringify(toolUse.input, null, 2) : ''
  const out = toolResult?.output || ''
  const isErr = toolResult?.isError === true
  const isLong = out.length > 600
  const shown = !open && isLong ? out.slice(0, 600) : out

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1.5px solid ${open ? 'var(--accent-tool-border)' : 'rgba(53, 109, 204, 0.16)'}`,
        background: open ? 'rgba(234, 241, 251, 0.88)' : 'rgba(234, 241, 251, 0.56)',
      }}
    >
      <button
        onClick={() => setOpen(x => !x)}
        className="flex items-center gap-2.5 w-full text-left px-4 py-2.5"
      >
        <ToolIcon className="w-4 h-4 flex-shrink-0" color="var(--accent-tool)" />
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--accent-tool-text)' }}>
          Tool
        </span>
        <code
          className="text-sm font-mono font-semibold px-2 py-0.5 rounded-md"
          style={{ background: 'var(--accent-tool-bg)', color: 'var(--accent-tool)' }}
        >
          {toolUse.name}
        </code>
        {!open && preview && (
          <span className="text-sm font-mono truncate flex-1" style={{ color: 'var(--accent-tool-text)', opacity: 0.72 }}>
            {preview}
          </span>
        )}
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{
            background: toolResult
              ? (isErr ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)')
              : 'var(--accent-system-bg)',
            color: toolResult
              ? (isErr ? 'var(--accent-error)' : 'var(--accent-success)')
              : 'var(--accent-system)',
          }}
        >
          {toolResult ? (isErr ? 'error' : 'done') : 'pending'}
        </span>
        <Chevron open={open} color="var(--accent-tool)" />
      </button>

      {open && inputStr && (
        <div style={{ borderTop: '1.5px solid rgba(53, 109, 204, 0.16)' }}>
          <div
            className="flex items-center gap-2 px-4 py-1.5"
            style={{ background: 'var(--accent-tool-bg)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-tool-text)' }}>
              Input
            </span>
            <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--accent-tool)' }}>
              json
            </span>
          </div>
          <pre
            className="px-4 py-3 text-sm font-mono leading-relaxed overflow-x-auto"
            style={{
              background: 'var(--accent-tool-soft)',
              color: 'var(--accent-tool-text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {inputStr.length > 4000 ? inputStr.slice(0, 4000) + '\n… (truncated)' : inputStr}
          </pre>
        </div>
      )}

      {toolResult && (
        <div style={{ borderTop: open && inputStr ? '1.5px solid rgba(53, 109, 204, 0.16)' : 'none' }}>
          <div
            className="flex items-center gap-2.5 px-4 py-2.5"
            style={{
              background: isErr ? 'var(--accent-error-bg)' : 'var(--accent-success-bg)',
              borderTop: `1.5px solid ${isErr ? 'var(--accent-error-border)' : 'var(--accent-success-border)'}`,
            }}
          >
          {isErr ? (
            <ErrorIcon className="w-4 h-4 flex-shrink-0" />
          ) : (
            <SuccessIcon className="w-4 h-4 flex-shrink-0" />
          )}
          <span
            className="text-xs font-black uppercase tracking-widest"
              style={{ color: isErr ? 'var(--accent-error)' : 'var(--accent-success)' }}
            >
              Result
            </span>
            <span
              className="ml-auto text-xs font-mono px-2 py-0.5 rounded-md"
              style={{
              background: isErr ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
                border: `1px solid ${isErr ? 'var(--accent-error-border)' : 'var(--accent-success-border)'}`,
                color: isErr ? 'var(--accent-error)' : 'var(--accent-success)',
              }}
            >
              {out.length.toLocaleString()} chars
            </span>
          </div>

          <pre
            className="px-4 py-3 text-sm font-mono leading-relaxed overflow-x-auto"
            style={{
              background: isErr ? 'var(--accent-error-soft)' : 'var(--accent-success-soft)',
              color: isErr ? 'var(--accent-error-text)' : 'var(--accent-success-text)',
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
                background: isErr ? 'var(--accent-error-bg)' : 'var(--accent-success-bg)',
                borderTop: `1px solid ${isErr ? 'var(--accent-error-border)' : 'var(--accent-success-border)'}`,
                color: isErr ? 'var(--accent-error)' : 'var(--accent-success)',
              }}
            >
              {open ? '▲ Collapse output' : `▼ Show all ${out.length.toLocaleString()} chars`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ToolIcon({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color }}>
      <path d="M9.87 1.77a4.1 4.1 0 0 0-3.76 6.84L2.5 12.23a1.25 1.25 0 1 0 1.77 1.77l3.62-3.61a4.1 4.1 0 0 0 6.84-3.76l-2.37 2.37-2.12-.53-.53-2.12 2.37-2.37Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ThinkingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.25a4.75 4.75 0 0 0-2.72 8.64c.39.27.72.82.72 1.36v.5h4v-.5c0-.54.33-1.09.72-1.36A4.75 4.75 0 0 0 8 2.25Z" stroke="var(--accent-thinking)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.25 14h3.5" stroke="var(--accent-thinking)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.25" stroke="var(--accent-success)" strokeWidth="1.4" />
      <path d="M5.5 8.1 7.2 9.8l3.3-3.6" stroke="var(--accent-success)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.25" stroke="var(--accent-error)" strokeWidth="1.4" />
      <path d="m6.1 6.1 3.8 3.8M9.9 6.1l-3.8 3.8" stroke="var(--accent-error)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.25" stroke="var(--accent-system)" strokeWidth="1.4" />
      <path d="M8 7v3M8 5.5h.01" stroke="var(--accent-system)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
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
