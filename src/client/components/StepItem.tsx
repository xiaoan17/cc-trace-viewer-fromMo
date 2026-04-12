import { useState } from 'react'
import type { TraceStep } from '@shared/types'
import { Markdown } from './Markdown'
import { RoleAvatar } from './RoleAvatar'

export function StepItem({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false)

  if (step.type === 'text') {
    return (
      <div className="message-bubble message-bubble-assistant prose-custom rounded-[28px] rounded-tl-lg px-7 py-6">
        <div className="mb-3 flex items-center gap-3.5">
          <RoleAvatar role="assistant" className="w-11 h-11" />
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-3 opacity-90">
            Assistant Message
          </div>
        </div>
        <Markdown>{step.text ?? ''}</Markdown>
      </div>
    )
  }

  /* ── Thinking ────────────────────────────── */
  if (step.type === 'thinking') {
    return (
      <div className="rounded-xl overflow-hidden border border-dashed border-accent-thinking-border bg-accent-thinking-bg/20 shadow-sm transition-all hover:shadow-md">
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-3 w-full text-left px-5 py-3 group"
        >
          <div className="w-7 h-7 rounded-lg bg-accent-thinking/10 flex items-center justify-center text-accent-thinking border border-accent-thinking/20 group-hover:scale-110 transition-transform shadow-sm">
            <ThinkingIcon className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-accent-thinking/90">
            Thinking Process
          </span>
          {!open && step.text && (
            <span className="text-xs truncate flex-1 italic text-accent-thinking/70 ml-3">
              {step.text.slice(0, 80)}…
            </span>
          )}
          <Chevron open={open} className="text-accent-thinking opacity-70" />
        </button>
        {open && (
          <div className="px-6 pb-5 pt-2 text-sm italic leading-relaxed text-accent-thinking/90 border-t border-dashed border-accent-thinking-border/40 animate-in fade-in duration-300">
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
      <div className={`rounded-xl overflow-hidden border transition-all duration-300 shadow-sm ${open ? 'bg-surface-1 border-accent-tool ring-1 ring-accent-tool/10 shadow-md' : 'bg-accent-tool-bg border-accent-tool-border hover:border-accent-tool hover:shadow-md'}`}>
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-3 w-full text-left px-5 py-3"
        >
          <div className="w-7 h-7 rounded-lg bg-accent-tool/10 flex items-center justify-center text-accent-tool border border-accent-tool/20 shadow-sm">
            <ToolIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-accent-tool-text/90">
            Call
          </span>
          <code className="text-[13px] font-mono font-bold px-2 py-0.5 rounded-md bg-accent-tool/15 text-accent-tool border border-accent-tool/20 shadow-sm">
            {step.name}
          </code>
          {!open && preview && (
            <span className="text-[12px] font-mono truncate flex-1 text-accent-tool-text/70 ml-3">
              {preview}
            </span>
          )}
          <Chevron open={open} className="text-accent-tool opacity-70" />
        </button>

        {open && inputStr && (
          <div className="border-t border-accent-tool-border/30">
            <div className="flex items-center justify-between px-5 py-2.5 bg-accent-tool-bg/40">
              <span className="text-[9px] font-black uppercase tracking-widest text-accent-tool-text opacity-70">Arguments</span>
              <span className="text-[9px] font-mono text-accent-tool opacity-50 uppercase">JSON</span>
            </div>
            <pre className="px-6 py-5 text-[13px] font-mono leading-relaxed overflow-x-auto text-accent-tool-text bg-surface-0/50 custom-scrollbar">
              {inputStr.length > 5000 ? inputStr.slice(0, 5000) + '\n… (data too large to display)' : inputStr}
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
    const isLong = out.length > 800
    const shown = !open && isLong ? out.slice(0, 800) : out

    return (
      <div className={`rounded-xl overflow-hidden border transition-all duration-300 shadow-sm ${
        isErr 
          ? 'border-accent-error-border bg-accent-error-bg/20 ring-1 ring-accent-error/10' 
          : 'border-accent-success-border bg-accent-success-bg/20 ring-1 ring-accent-success/10'
      }`}>
        <div className={`flex items-center gap-3 px-5 py-3 border-b ${
          isErr ? 'border-accent-error-border/40' : 'border-accent-success-border/40'
        }`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors shadow-sm ${
            isErr ? 'bg-accent-error/10 border-accent-error/20 text-accent-error' : 'bg-accent-success/10 border-accent-success/20 text-accent-success'
          }`}>
            {isErr ? <ErrorIcon className="w-4 h-4" /> : <SuccessIcon className="w-4 h-4" />}
          </div>
          <span className={`text-[11px] font-black uppercase tracking-widest ${isErr ? 'text-accent-error/90' : 'text-accent-success/90'}`}>
            {isErr ? 'System Error' : 'Execution Result'}
          </span>
          <span className={`ml-auto text-[10px] font-mono font-bold px-2 py-1 rounded-full border shadow-sm ${
            isErr ? 'bg-accent-error/15 border-accent-error/20 text-accent-error' : 'bg-accent-success/15 border-accent-success/20 text-accent-success'
          }`}>
            {out.length.toLocaleString()} bytes
          </span>
        </div>

        <pre className={`px-6 py-5 text-[13px] font-mono leading-relaxed overflow-x-auto custom-scrollbar ${
          isErr ? 'text-accent-error-text bg-accent-error-soft/50' : 'text-accent-success-text bg-accent-success-soft/50'
        }`} style={{
          maxHeight: open ? 'none' : '240px',
          overflow: open ? 'visible' : 'hidden',
        }}>
          {shown || <span className="opacity-40 italic">(No output content)</span>}
        </pre>

        {isLong && (
          <button
            onClick={() => setOpen(x => !x)}
            className={`w-full px-4 py-3 text-[11px] font-black uppercase tracking-widest text-center border-t transition-colors ${
              isErr 
                ? 'bg-accent-error-bg/50 border-accent-error-border/40 text-accent-error hover:bg-accent-error-bg' 
                : 'bg-accent-success-bg/50 border-accent-success-border/40 text-accent-success hover:bg-accent-success-bg'
            }`}
          >
            {open ? 'COLLAPSE LOG OUTPUT' : `EXPAND FULL LOG (${out.length.toLocaleString()} CHARS)`}
          </button>
        )}
      </div>
    )
  }

  if (step.type === 'system') {
    const body = step.text || ''
    const isTask = step.name?.startsWith('task') === true
    const isTaskError = isTask && step.isError === true
    
    return (
      <div className={`rounded-xl overflow-hidden border transition-all duration-300 shadow-sm ${open ? 'ring-1 ring-border-3 shadow-md' : 'bg-surface-2 border-border-2 hover:border-border-3 hover:shadow-md'}`}>
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-3 w-full text-left px-5 py-3 group"
        >
          <div className="w-7 h-7 rounded-lg bg-surface-3 flex items-center justify-center text-text-3 border border-border-2 group-hover:text-text-1 group-hover:border-border-3 transition-colors shadow-sm">
            {isTask ? <ToolIcon className="w-4 h-4" /> : <InfoIcon className="w-4 h-4" />}
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-text-3/90">
            {isTask ? (isTaskError ? 'Task Failed' : 'Task Event') : 'System Log'}
          </span>
          {step.name && (
            <code className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-surface-3 text-text-2 border border-border-1 ml-3 shadow-sm">
              {step.name.replace(/^task_/, '')}
            </code>
          )}
          <Chevron open={open} className="text-text-4 opacity-70" />
        </button>
        {open && body && (
          <div className="px-6 pb-5 pt-2 animate-in fade-in duration-300">
            <pre className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words text-text-2 bg-surface-1/50 p-4 rounded-lg border border-border-1 custom-scrollbar">
              {body}
            </pre>
          </div>
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
  const isLong = out.length > 800
  const shown = !open && isLong ? out.slice(0, 800) : out

  return (
    <div className={`rounded-xl overflow-hidden border transition-all duration-300 shadow-sm ${open ? 'bg-surface-1 border-accent-tool ring-1 ring-accent-tool/10 shadow-md' : 'bg-surface-2 border-border-2 hover:border-border-3 hover:shadow-md'}`}>
      {/* Tool Header */}
      <button
        onClick={() => setOpen(x => !x)}
        className="flex items-center gap-3 w-full text-left px-5 py-3 group"
      >
        <div className="w-8 h-8 rounded-xl bg-accent-tool/10 flex items-center justify-center text-accent-tool border border-accent-tool/20 shadow-sm">
          <ToolIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-accent-tool-text opacity-70">Action</span>
            <code className="text-[13px] font-mono font-bold text-accent-tool">{toolUse.name}</code>
          </div>
          {!open && preview && (
            <div className="text-[11px] font-mono truncate text-text-4 opacity-70">{preview}</div>
          )}
        </div>
        
        {/* Status Badge */}
        <div className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${
          toolResult 
            ? (isErr ? 'bg-accent-error/15 border-accent-error/20 text-accent-error' : 'bg-accent-success/15 border-accent-success/20 text-accent-success')
            : 'bg-surface-3 border-border-2 text-text-4'
        }`}>
          {toolResult ? (isErr ? 'FAILED' : 'PENDING') : 'PENDING'}
        </div>
        <Chevron open={open} className="text-text-4 opacity-70" />
      </button>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Input Block */}
          {inputStr && (
            <div className="border-t border-border-1 bg-surface-1">
              <div className="flex items-center justify-between px-5 py-2.5 bg-surface-2/50">
                <span className="text-[9px] font-black uppercase tracking-widest text-text-3">Arguments</span>
                <span className="text-[9px] font-mono text-text-4">JSON</span>
              </div>
              <pre className="px-6 py-5 text-[13px] font-mono leading-relaxed overflow-x-auto text-text-2 custom-scrollbar">
                {inputStr.length > 5000 ? inputStr.slice(0, 5000) + '\n… (truncated)' : inputStr}
              </pre>
            </div>
          )}

          {/* Result Block */}
          {toolResult && (
            <div className={`border-t ${isErr ? 'border-accent-error-border/30 bg-accent-error-bg/20' : 'border-accent-success-border/30 bg-accent-success-bg/20'}`}>
              <div className="flex items-center justify-between px-5 py-2.5 opacity-80">
                <span className={`text-[9px] font-black uppercase tracking-widest ${isErr ? 'text-accent-error' : 'text-accent-success'}`}>
                  {isErr ? 'Error Trace' : 'Response Output'}
                </span>
                <span className="text-[9px] font-mono opacity-50 tabular-nums">{out.length.toLocaleString()} bytes</span>
              </div>
              <pre className={`px-6 py-5 text-[13px] font-mono leading-relaxed overflow-x-auto custom-scrollbar ${
                isErr ? 'text-accent-error-text' : 'text-accent-success-text'
              }`} style={{
                maxHeight: open ? 'none' : '240px',
                overflow: open ? 'visible' : 'hidden',
              }}>
                {shown || <span className="opacity-30 italic">(Empty Response)</span>}
              </pre>
              
              {isLong && (
                <button
                  onClick={(e) => { e.stopPropagation(); setOpen(x => !x); }}
                  className={`w-full py-3 text-[11px] font-black uppercase tracking-widest text-center border-t transition-colors ${
                    isErr ? 'border-accent-error-border/20 hover:bg-accent-error-bg/40 text-accent-error' : 'border-accent-success-border/20 hover:bg-accent-success-bg/40 text-accent-success'
                  }`}
                >
                  {open ? 'COLLAPSE OUTPUT' : 'EXPAND COMPLETE OUTPUT'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToolIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color }}>
      <path 
        d="M13.5 10.5c.5.5.5 1.5 0 2s-1.5.5-2 0l-1-1-2.5 2.5a1.5 1.5 0 0 1-2 0l-3-3a1.5 1.5 0 0 1 0-2l2.5-2.5-1-1c-.5-.5-.5-1.5 0-2s1.5-.5 2 0l7 7Z" 
        stroke="currentColor" 
        strokeWidth="1.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="m4.5 11.5-2 2M10.5 5.5l2-2" 
        stroke="currentColor" 
        strokeWidth="1.2" 
        strokeLinecap="round" 
      />
    </svg>
  )
}

function ThinkingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path 
        d="M8 1.5c-3 0-5 2.2-5 4.5 0 1.5.5 2.5 1.5 3.5.5.5 1 1 1 2h5s.5-1.5 1-2c1-1 1.5-2 1.5-3.5 0-2.3-2-4.5-5-4.5Z" 
        stroke="currentColor" 
        strokeWidth="1.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path d="M6 13.5h4M6.5 11.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 4.5v2M6.5 5.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="m4.5 8 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="m5.5 5.5 5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7.5v3M8 5.5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`w-3.5 h-3.5 flex-shrink-0 ml-auto transition-transform duration-200 ${open ? 'rotate-90' : ''} ${className}`}
      viewBox="0 0 16 16" fill="none"
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function clip(s: string, n = 80) { return s.length > n ? s.slice(0, n) + '…' : s }
