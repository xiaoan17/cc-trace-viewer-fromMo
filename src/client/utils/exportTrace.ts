import type { TraceSession, SessionMeta } from '@shared/types'

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
