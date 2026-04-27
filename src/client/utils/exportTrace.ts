import type { TraceSession, SessionMeta, TraceTurn, TraceStep } from '@shared/types'

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildFilename(meta: SessionMeta, ext: string) {
  const date = new Date(meta.startedAt).toISOString().slice(0, 10)
  const shortId = meta.id.slice(0, 8)
  return `trace-${meta.source}-${shortId}-${date}.${ext}`
}

export function exportAsJSON(session: TraceSession, meta: SessionMeta) {
  const content = JSON.stringify(session, null, 2)
  triggerDownload(content, buildFilename(meta, 'json'), 'application/json')
}

export function exportAsHTML(session: TraceSession, meta: SessionMeta) {
  const html = buildHTML(session, meta)
  triggerDownload(html, buildFilename(meta, 'html'), 'text/html')
}

// ─── HTML builder ────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, { accent: string; badge: string }> = {
  claude: { accent: '#c2410c', badge: 'rgba(234,88,12,0.12)' },
  codex:  { accent: '#1d4ed8', badge: 'rgba(29,78,216,0.10)' },
  gemini: { accent: '#6d28d9', badge: 'rgba(109,40,217,0.10)' },
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function shortPath(p = '') {
  return p.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')
}

function renderToolPair(toolUse: TraceStep, toolResult?: TraceStep): string {
  const inputJson = toolUse.input && Object.keys(toolUse.input).length > 0
    ? `<div class="pair-section"><div class="pair-label">Input</div><pre class="code-block">${esc(JSON.stringify(toolUse.input, null, 2))}</pre></div>`
    : ''

  let resultHtml = ''
  if (toolResult) {
    const output = toolResult.output ?? ''
    const preview = output.length > 800 ? output.slice(0, 800) + '\n… (truncated)' : output
    const isError = toolResult.isError
    resultHtml = `<div class="pair-section pair-result${isError ? ' pair-result-error' : ''}">
      <div class="pair-label">${isError ? 'Error' : 'Output'}</div>
      ${preview ? `<pre class="code-block">${esc(preview)}</pre>` : '<span class="no-input">(empty)</span>'}
    </div>`
  }

  const previewText = toolResult?.output
    ? toolResult.output.slice(0, 60).replace(/\n/g, ' ') + (toolResult.output.length > 60 ? '…' : '')
    : ''

  return `
    <details class="step step-tool-pair">
      <summary class="step-summary">
        <span class="chevron"></span>
        <span class="step-badge badge-tool">tool</span>
        <strong class="tool-name">${esc(toolUse.name ?? 'unknown')}</strong>
        ${toolUse.callId ? `<span class="call-id">${esc(toolUse.callId)}</span>` : ''}
        ${previewText ? `<span class="preview-hint">${esc(previewText)}</span>` : ''}
        ${toolResult?.isError ? `<span class="step-badge badge-error">error</span>` : ''}
      </summary>
      <div class="step-body">
        ${inputJson}
        ${resultHtml}
      </div>
    </details>`
}

function renderStep(step: TraceStep): string {
  if (step.type === 'thinking') {
    const text = step.text ?? ''
    return `
      <details class="step step-thinking">
        <summary class="step-summary">
          <span class="chevron"></span>
          <span class="step-badge badge-thinking">thinking</span>
          <span class="preview-hint">${esc(text.slice(0, 60).replace(/\n/g, ' '))}${text.length > 60 ? '…' : ''}</span>
        </summary>
        <div class="step-body"><div class="thinking-text">${esc(text)}</div></div>
      </details>`
  }
  if (step.type === 'text') {
    const text = step.text ?? ''
    return `
      <details class="step step-text" open>
        <summary class="step-summary">
          <span class="chevron"></span>
          <span class="step-badge badge-text">text</span>
          <span class="preview-hint">${esc(text.slice(0, 60).replace(/\n/g, ' '))}${text.length > 60 ? '…' : ''}</span>
        </summary>
        <div class="step-body"><div class="plain-text">${esc(text)}</div></div>
      </details>`
  }
  return ''
}

function renderTurn(turn: TraceTurn, index: number): string {
  // Pair tool_use with its matching tool_result; pass through other steps
  const consumed = new Set<number>()
  const stepsHtml = turn.steps.map((step, i) => {
    if (consumed.has(i)) return ''
    if (step.type === 'tool_use' && step.callId) {
      const resultIdx = turn.steps.findIndex(
        (s, j) => j > i && !consumed.has(j) && s.type === 'tool_result' && s.callId === step.callId
      )
      if (resultIdx !== -1) {
        consumed.add(resultIdx)
        return renderToolPair(step, turn.steps[resultIdx])
      }
      return renderToolPair(step)
    }
    if (step.type === 'tool_result') return '' // already consumed above or orphan
    return renderStep(step)
  }).join('')
  const tokenHtml = turn.tokenUsage
    ? `<div class="token-row">
        <span class="token-chip">&#8593; ${turn.tokenUsage.input.toLocaleString()} in</span>
        <span class="token-chip">&#8595; ${turn.tokenUsage.output.toLocaleString()} out</span>
        ${turn.tokenUsage.cached ? `<span class="token-chip chip-cached">&#9889; ${turn.tokenUsage.cached.toLocaleString()} cached</span>` : ''}
       </div>`
    : ''
  const assistantBubble = turn.assistantMessage
    ? `<div class="bubble bubble-assistant">${esc(turn.assistantMessage)}</div>`
    : ''

  return `
    <div class="turn">
      <div class="turn-index">${index + 1}</div>

      <div class="turn-body">
        <div class="role-row role-user">
          <span class="role-label">User</span>
        </div>
        <div class="bubble bubble-user">${esc(turn.userMessage)}</div>

        <div class="role-row role-assistant">
          <span class="role-label">Assistant</span>
          ${tokenHtml}
        </div>
        ${stepsHtml ? `<div class="steps-block">${stepsHtml}</div>` : ''}
        ${assistantBubble}
      </div>
    </div>`
}

function buildHTML(session: TraceSession, meta: SessionMeta): string {
  const c = SOURCE_COLORS[meta.source] ?? SOURCE_COLORS.claude
  const totalTools = session.turns.reduce(
    (n, t) => n + t.steps.filter(s => s.type === 'tool_use').length, 0)
  const turnsHtml = session.turns.map((t, i) => renderTurn(t, i)).join('')
  const date = new Date(meta.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trace: ${esc(meta.source)} / ${esc(shortPath(meta.cwd))}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0f0f13; color: #e2e2e8; line-height: 1.6; }

  /* ── Header ── */
  .header { background: #18181f; border-bottom: 1px solid #2a2a36; padding: 32px 40px; }
  .header-inner { max-width: 900px; margin: 0 auto; display: flex; align-items: flex-start; gap: 20px; }
  .source-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; border: 2px solid; flex-shrink: 0; background: #0f0f13; color: ${c.accent}; border-color: ${c.accent}40; }
  .header-meta { min-width: 0; }
  .source-badge { display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid ${c.accent}40; background: ${c.badge}; color: ${c.accent}; }
  .model-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-family: monospace; font-weight: 700; background: #2a2a36; color: #a0a0b8; border: 1px solid #2a2a36; margin-left: 8px; text-transform: uppercase; letter-spacing: 0.1em; }
  .session-id { font-size: 10px; font-family: monospace; color: #606078; margin-left: 10px; }
  .cwd { font-size: 22px; font-weight: 800; color: #f0f0f8; margin: 8px 0 6px; letter-spacing: -0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stats { display: flex; gap: 10px; flex-wrap: wrap; }
  .stat { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; padding: 4px 10px; border-radius: 8px; background: #23232f; border: 1px solid #2a2a36; color: #a0a0b8; }
  .stat strong { color: #e2e2e8; margin-right: 4px; }

  /* ── Turns ── */
  .turns { max-width: 900px; margin: 0 auto; padding: 40px 40px 80px; display: flex; flex-direction: column; gap: 56px; }
  .turn { display: flex; gap: 16px; }
  .turn-index { font-size: 10px; font-family: monospace; font-weight: 900; color: #606078; width: 24px; flex-shrink: 0; text-align: center; padding-top: 6px; }
  .turn-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }

  /* ── Roles ── */
  .role-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .role-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: #70708a; }
  .role-user { justify-content: flex-end; }

  /* ── Bubbles ── */
  .bubble { white-space: pre-wrap; word-break: break-word; font-size: 14px; line-height: 1.7; border-radius: 20px; padding: 16px 22px; }
  .bubble-user { background: #1e2a45; border: 1px solid #2a3a5a; border-top-right-radius: 6px; align-self: flex-end; max-width: 88%; }
  .bubble-assistant { background: #1c1c26; border: 1px solid #2a2a3a; border-top-left-radius: 6px; max-width: 96%; }

  /* ── Tokens ── */
  .token-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .token-chip { font-size: 9px; font-family: monospace; font-weight: 900; padding: 3px 8px; border-radius: 6px; background: #1c1c26; border: 1px solid #2a2a3a; color: #7070a0; }
  .chip-cached { background: #2a2208; border-color: #a06030; color: #e09050; }

  /* ── Steps ── */
  .steps-block { display: flex; flex-direction: column; gap: 10px; }
  .step { border-radius: 14px; font-size: 13px; border: 1px solid; overflow: hidden; }
  .step-tool-pair { background: #13221a; border-color: #1e4d30; }
  .step-tool-error { background: #2a1010; border-color: #5a2020; }
  .step-thinking   { background: #201a0c; border-color: #4a3010; }
  .step-text       { background: #1a1a22; border-color: #2a2a3e; }

  /* summary row */
  .step-summary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 16px; cursor: pointer; list-style: none; user-select: none; }
  .step-summary::-webkit-details-marker { display: none; }
  .step-summary:hover { filter: brightness(1.1); }

  /* animated chevron */
  .chevron { display: inline-block; width: 14px; height: 14px; flex-shrink: 0; transition: transform 0.2s; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M6 4l4 4-4 4' stroke='%23606080' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat; }
  details[open] > summary .chevron { transform: rotate(90deg); }

  .tool-name { font-weight: 700; color: #d0f0d8; }
  .preview-hint { font-size: 11px; color: #606080; font-style: italic; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 380px; }
  .no-input { font-size: 11px; color: #505060; font-style: italic; }

  /* body revealed when open */
  .step-body { padding: 0 16px 14px; display: flex; flex-direction: column; gap: 10px; }

  /* input / output sections inside a pair */
  .pair-section { display: flex; flex-direction: column; gap: 4px; }
  .pair-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; color: #507060; }
  .pair-result .pair-label { color: #506080; }
  .pair-result-error .pair-label { color: #904040; }

  .step-badge { font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.1em; flex-shrink: 0; }
  .badge-tool    { background: #1e4d30; color: #60d090; }
  .badge-error   { background: #4d1e1e; color: #d06060; }
  .badge-thinking{ background: #4a3010; color: #d09030; }
  .badge-text    { background: #2a2a3e; color: #9090c0; }
  .call-id { font-family: monospace; font-size: 10px; color: #606080; flex-shrink: 0; }

  .code-block { font-family: ui-monospace, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; background: #0d0d14; border: 1px solid #1e1e2e; border-radius: 8px; padding: 12px 14px; margin-top: 8px; color: #c0c0e0; line-height: 1.5; max-height: 400px; overflow-y: auto; }
  .thinking-text { font-size: 13px; color: #c09040; white-space: pre-wrap; word-break: break-word; margin-top: 6px; }
  .plain-text { font-size: 13px; color: #d0d0e8; white-space: pre-wrap; word-break: break-word; margin-top: 6px; }
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <div class="source-icon">${esc(meta.source.slice(0, 1).toUpperCase())}</div>
    <div class="header-meta">
      <div>
        <span class="source-badge">${esc(meta.source)}</span>
        ${meta.model ? `<span class="model-badge">${esc(meta.model.split('/').pop()?.split(':')[0] ?? meta.model)}</span>` : ''}
        <span class="session-id">${esc(meta.id)}</span>
      </div>
      <div class="cwd">${esc(shortPath(meta.cwd) || 'Root Directory')}</div>
      <div class="stats">
        <span class="stat"><strong>${esc(date)}</strong></span>
        <span class="stat"><strong>${session.turns.length}</strong> turns</span>
        ${totalTools > 0 ? `<span class="stat"><strong>${totalTools}</strong> tool calls</span>` : ''}
      </div>
    </div>
  </div>
</div>

<div class="turns">${turnsHtml}</div>

</body>
</html>`
}

export function exportAsMarkdown(session: TraceSession, meta: SessionMeta) {
  const totalTools = session.turns.reduce(
    (n, t) => n + t.steps.filter(s => s.type === 'tool_use').length,
    0
  )
  const shortPath = (p = '') => p.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')

  const lines: string[] = [
    `# Trace: ${meta.source.toUpperCase()} / ${shortPath(meta.cwd) || 'Root Directory'}`,
    '',
    [
      `**Date**: ${new Date(meta.startedAt).toLocaleString()}`,
      meta.model ? `**Model**: ${meta.model.split('/').pop()?.split(':')[0]}` : null,
      `**Turns**: ${session.turns.length}`,
      totalTools > 0 ? `**Tool calls**: ${totalTools}` : null,
      `**ID**: \`${meta.id}\``,
    ].filter(Boolean).join(' | '),
    '',
    '---',
    '',
  ]

  session.turns.forEach((turn, i) => {
    lines.push(`## Turn ${i + 1}`)
    lines.push('')
    lines.push('### User')
    lines.push('')
    lines.push(turn.userMessage)
    lines.push('')

    lines.push('### Assistant')
    lines.push('')

    if (turn.tokenUsage) {
      const { input, output, cached } = turn.tokenUsage
      const tokenParts = [`↑ ${input.toLocaleString()} in`, `↓ ${output.toLocaleString()} out`]
      if (cached) tokenParts.push(`⚡ ${cached.toLocaleString()} cached`)
      lines.push(`> **Tokens**: ${tokenParts.join(' · ')}`)
      lines.push('')
    }

    const toolUseSteps = turn.steps.filter(s => s.type === 'tool_use')
    if (toolUseSteps.length > 0) {
      lines.push('#### Tool Calls')
      lines.push('')
      for (const step of toolUseSteps) {
        lines.push(`- **${step.name ?? 'unknown'}**${step.callId ? ` (\`${step.callId}\`)` : ''}`)
        if (step.input && Object.keys(step.input).length > 0) {
          const inputStr = JSON.stringify(step.input, null, 2)
          lines.push('  ```json')
          lines.push(inputStr.split('\n').map(l => '  ' + l).join('\n'))
          lines.push('  ```')
        }
        // Find matching tool_result
        const result = turn.steps.find(s => s.type === 'tool_result' && s.callId === step.callId)
        if (result?.output) {
          const out = result.output.length > 500
            ? result.output.slice(0, 500) + '\n… (truncated)'
            : result.output
          lines.push('  **Output**:')
          lines.push('  ```')
          lines.push(out.split('\n').map(l => '  ' + l).join('\n'))
          lines.push('  ```')
        }
      }
      lines.push('')
    }

    if (turn.assistantMessage) {
      lines.push(turn.assistantMessage)
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  })

  triggerDownload(lines.join('\n'), buildFilename(meta, 'md'), 'text/markdown')
}
