import { useState } from 'react'
import type { TraceStep } from '@shared/types'
import { Markdown } from './Markdown'

export function StepItem({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false)

  if (step.type === 'text') {
    return (
      <div className="prose-custom rounded-2xl rounded-tl-sm px-6 py-4 text-sm bg-surface-1 border border-accent-agent-border shadow-sm ring-1 ring-accent-agent/5">
        <div className="text-[10px] font-bold uppercase tracking-widest mb-3 text-accent-agent opacity-70">
          Assistant Message
        </div>
        <Markdown>{step.text ?? ''}</Markdown>
      </div>
    )
  }

  /* ── Thinking ────────────────────────────── */
  if (step.type === 'thinking') {
    return (
      <div className="rounded-xl overflow-hidden border border-dashed border-accent-thinking-border bg-accent-thinking-bg/30">
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-3 w-full text-left px-4 py-3 group"
        >
          <div className="w-6 h-6 rounded-lg bg-accent-thinking/10 flex items-center justify-center text-accent-thinking border border-accent-thinking/20 group-hover:scale-110 transition-transform">
            <ThinkingIcon className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-accent-thinking">
            Thinking Process
          </span>
          {!open && step.text && (
            <span className="text-xs truncate flex-1 italic text-accent-thinking/60 ml-2">
              {step.text.slice(0, 80)}…
            </span>
          )}
          <Chevron open={open} className="text-accent-thinking" />
        </button>
        {open && (
          <div className="px-5 pb-4 pt-1 text-sm italic leading-relaxed text-accent-thinking/80 border-t border-dashed border-accent-thinking-border/40 animate-in fade-in duration-300">
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
      <div className={`rounded-xl overflow-hidden border transition-all duration-200 ${
        open ? 'bg-surface-1 border-accent-tool shadow-md' : 'bg-accent-tool-bg border-accent-tool-border hover:border-accent-tool'
      }`}>
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-3 w-full text-left px-4 py-3"
        >
          <div className="w-6 h-6 rounded-lg bg-accent-tool/10 flex items-center justify-center text-accent-tool border border-accent-tool/20">
            <ToolIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-accent-tool-text">
            Call
          </span>
          <code className="text-[13px] font-mono font-bold px-2 py-0.5 rounded-md bg-accent-tool/10 text-accent-tool border border-accent-tool/20">
            {step.name}
          </code>
          {!open && preview && (
            <span className="text-[12px] font-mono truncate flex-1 text-accent-tool-text/60 ml-2">
              {preview}
            </span>
          )}
          <Chevron open={open} className="text-accent-tool" />
        </button>

        {open && inputStr && (
          <div className="border-t border-accent-tool-border/30">
            <div className="flex items-center justify-between px-4 py-2 bg-accent-tool-bg/50">
              <span className="text-[9px] font-bold uppercase tracking-widest text-accent-tool-text opacity-70">Argument Map</span>
              <span className="text-[9px] font-mono text-accent-tool opacity-50 uppercase">JSON OBJECT</span>
            </div>
            <pre className="px-5 py-4 text-[13px] font-mono leading-relaxed overflow-x-auto text-accent-tool-text bg-surface-0/50 custom-scrollbar">
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
      <div className={`rounded-xl overflow-hidden border transition-all duration-200 ${
        isErr ? 'border-accent-error-border bg-accent-error-bg/30' : 'border-accent-success-border bg-accent-success-bg/30'
      }`}>
        <div className={`flex items-center gap-3 px-4 py-3 border-b ${
          isErr ? 'border-accent-error-border/40' : 'border-accent-success-border/40'
        }`}>
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
            isErr ? 'bg-accent-error/10 border-accent-error/20 text-accent-error' : 'bg-accent-success/10 border-accent-success/20 text-accent-success'
          }`}>
            {isErr ? <ErrorIcon className="w-3.5 h-3.5" /> : <SuccessIcon className="w-3.5 h-3.5" />}
          </div>
          <span className={`text-[11px] font-black uppercase tracking-widest ${isErr ? 'text-accent-error' : 'text-accent-success'}`}>
            {isErr ? 'System Error' : 'Execution Result'}
          </span>
          <span className={`ml-auto text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            isErr ? 'bg-accent-error/10 border-accent-error/20 text-accent-error' : 'bg-accent-success/10 border-accent-success/20 text-accent-success'
          }`}>
            {out.length.toLocaleString()} bytes
          </span>
        </div>

        <pre className={`px-5 py-4 text-[13px] font-mono leading-relaxed overflow-x-auto custom-scrollbar ${
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
            className={`w-full px-4 py-2.5 text-[11px] font-bold text-center border-t transition-colors ${
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
      <div className={`rounded-xl overflow-hidden border border-border-2 bg-surface-2/50 ${open ? 'ring-1 ring-border-3 shadow-sm' : ''}`}>
        <button
          onClick={() => setOpen(x => !x)}
          className="flex items-center gap-3 w-full text-left px-4 py-3 group"
        >
          <div className="w-6 h-6 rounded-lg bg-surface-3 flex items-center justify-center text-text-3 border border-border-2 group-hover:text-text-1 group-hover:border-border-3 transition-colors">
            {isTask ? <ToolIcon className="w-3.5 h-3.5" /> : <InfoIcon className="w-3.5 h-3.5" />}
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-text-3">
            {isTask ? (isTaskError ? 'Task Failed' : 'Task Event') : 'System Log'}
          </span>
          {step.name && (
            <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-text-2 ml-2">
              {step.name.replace(/^task_/, '')}
            </code>
          )}
          <Chevron open={open} className="text-text-4" />
        </button>
        {open && body && (
          <div className="px-5 pb-4 pt-1 animate-in fade-in duration-300">
            <pre className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words text-text-2 bg-surface-1/50 p-3 rounded-lg border border-border-1">
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
    <div className={`rounded-xl overflow-hidden border transition-all duration-200 ${
      open ? 'bg-surface-1 border-accent-tool shadow-lg ring-1 ring-accent-tool/10' : 'bg-surface-2 border-border-1 hover:border-border-3'
    }`}>
      {/* Tool Header */}
      <button
        onClick={() => setOpen(x => !x)}
        className="flex items-center gap-3 w-full text-left px-4 py-3"
      >
        <div className="w-8 h-8 rounded-xl bg-accent-tool/10 flex items-center justify-center text-accent-tool border border-accent-tool/20">
          <ToolIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-accent-tool-text opacity-70">Action</span>
            <code className="text-[13px] font-mono font-bold text-accent-tool">{toolUse.name}</code>
          </div>
          {!open && preview && (
            <div className="text-[11px] font-mono truncate text-text-4">{preview}</div>
          )}
        </div>
        
        {/* Status Badge */}
        <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
          toolResult 
            ? (isErr ? 'bg-accent-error/10 border-accent-error/20 text-accent-error' : 'bg-accent-success/10 border-accent-success/20 text-accent-success')
            : 'bg-surface-3 border-border-1 text-text-4'
        }`}>
          {toolResult ? (isErr ? 'FAILED' : 'SUCCESS') : 'PENDING'}
        </div>
        <Chevron open={open} className="text-text-4" />
      </button>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Input Block */}
          {inputStr && (
            <div className="border-t border-border-1 bg-surface-1">
              <div className="flex items-center justify-between px-4 py-2 bg-surface-2/50">
                <span className="text-[9px] font-bold uppercase tracking-widest text-text-3">Arguments</span>
                <span className="text-[9px] font-mono text-text-4">JSON</span>
              </div>
              <pre className="px-5 py-4 text-[13px] font-mono leading-relaxed overflow-x-auto text-text-2 custom-scrollbar">
                {inputStr.length > 5000 ? inputStr.slice(0, 5000) + '\n… (truncated)' : inputStr}
              </pre>
            </div>
          )}

          {/* Result Block */}
          {toolResult && (
            <div className={`border-t ${isErr ? 'border-accent-error-border/30 bg-accent-error-bg/20' : 'border-accent-success-border/30 bg-accent-success-bg/20'}`}>
              <div className="flex items-center justify-between px-4 py-2 opacity-80">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${isErr ? 'text-accent-error' : 'text-accent-success'}`}>
                  {isErr ? 'Error Trace' : 'Response Output'}
                </span>
                <span className="text-[9px] font-mono opacity-50 tabular-nums">{out.length.toLocaleString()} bytes</span>
              </div>
              <pre className={`px-5 py-4 text-[13px] font-mono leading-relaxed overflow-x-auto custom-scrollbar ${
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
                  className={`w-full py-2 text-[10px] font-bold text-center border-t transition-colors ${
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
      <path d="M9.87 1.77a4.1 4.1 0 0 0-3.76 6.84L2.5 12.23a1.25 1.25 0 1 0 1.77 1.77l3.62-3.61a4.1 4.1 0 0 0 6.84-3.76l-2.37 2.37-2.12-.53-.53-2.12 2.37-2.37Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ThinkingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.25a4.75 4.75 0 0 0-2.72 8.64c.39.27.72.82.72 1.36v.5h4v-.5c0-.54.33-1.09.72-1.36A4.75 4.75 0 0 0 8 2.25Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.25 14h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 8.1 7.2 9.8l3.3-3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m6.1 6.1 3.8 3.8M9.9 6.1l-3.8 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7v3M8 5.5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
