import fs from 'fs'
import os from 'os'
import path from 'path'
import { createInterface } from 'readline'
import type { SessionMeta } from '../../shared/types.js'

const CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects')

/** Fast meta-only read: only scans first ~20 lines to get session metadata + counts user turns */
export async function readClaudeMeta(filePath: string): Promise<SessionMeta | null> {
  try {
    const rl = createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })

    let sessionId = ''
    let cwd = ''
    let startedAt = ''
    let turnCount = 0
    let linesRead = 0

    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) continue
      linesRead++

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj = JSON.parse(trimmed) as any

        if (!sessionId && obj.sessionId) {
          sessionId = obj.sessionId
          cwd = obj.cwd || ''
          startedAt = obj.timestamp || ''
        }

        // Count user turns (non-tool-result user messages)
        if (obj.type === 'user' && obj.message?.role === 'user') {
          const content = obj.message.content
          const isToolResult =
            Array.isArray(content) &&
            content.some(
              (c: { type?: string }) => c.type === 'tool_result'
            )
          if (!isToolResult) {
            const text = typeof content === 'string' ? content : ''
            if (text || !Array.isArray(content)) turnCount++
          }
        }
      } catch {
        // skip
      }

      // Stop early once we have enough data (meta found + reasonable sample)
      if (sessionId && linesRead > 500) break
    }

    rl.close()

    if (!sessionId) return null

    const projectPath = filePath
      .split('/projects/')[1]
      ?.split('/')[0]
      ?.replace(/-/g, '/')

    return {
      id: sessionId,
      source: 'claude',
      startedAt,
      cwd,
      projectPath,
      turnCount,
      filePath,
    }
  } catch {
    return null
  }
}

export async function listClaudeSessions(): Promise<string[]> {
  const files: string[] = []
  if (!fs.existsSync(CLAUDE_DIR)) return files

  for (const project of fs.readdirSync(CLAUDE_DIR)) {
    const projectDir = path.join(CLAUDE_DIR, project)
    try {
      if (!fs.statSync(projectDir).isDirectory()) continue
      for (const sf of fs.readdirSync(projectDir)) {
        if (sf.endsWith('.jsonl')) files.push(path.join(projectDir, sf))
      }
    } catch {
      // skip
    }
  }
  return files
}

// ── Full parse (only called when a session is selected) ──────────────────────

async function readJsonLines(filePath: string): Promise<unknown[]> {
  const lines: unknown[] = []
  const rl = createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try { lines.push(JSON.parse(trimmed)) } catch { /* skip */ }
  }
  return lines
}

function extractText(content: unknown[]): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((c: unknown) => {
      if (typeof c === 'string') return c
      const item = c as Record<string, unknown>
      if (item.type === 'text') return item.text as string
      if (item.type === 'thinking') return ''
      if (typeof item.text === 'string') return item.text
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

import type { TraceSession, TraceTurn, TraceStep } from '../../shared/types.js'

export async function parseClaudeSession(filePath: string): Promise<TraceSession | null> {
  try {
    const records = await readJsonLines(filePath)
    if (records.length === 0) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recs = records as any[]
    const anyRecord = recs.find((r) => r.sessionId)
    if (!anyRecord) return null

    const sessionId = anyRecord.sessionId as string
    const cwd = anyRecord.cwd as string
    const startedAt = anyRecord.timestamp as string
    const projectPath = filePath.split('/projects/')[1]?.split('/')[0]?.replace(/-/g, '/')

    // Identify turn-starter user messages: user nodes whose content is NOT purely tool_results
    const turnStarterUuids = new Set<string>()
    const userMessages: (typeof recs) = []
    for (const r of recs) {
      if (r.type !== 'user' || r.message?.role !== 'user' || !r.message?.content) continue
      const c = r.message.content
      const isPureToolResult =
        Array.isArray(c) && c.length > 0 &&
        (c as Record<string, unknown>[]).every(item => item.type === 'tool_result')
      if (!isPureToolResult) {
        turnStarterUuids.add(r.uuid)
        userMessages.push(r)
      }
    }

    const turns: TraceTurn[] = []
    let turnIndex = 0

    for (const userMsg of userMessages) {
      const content = userMsg.message?.content
      const userText =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? extractText(content)
            : ''
      if (!userText.trim()) continue
      // Skip internal system messages injected by the shell/tool context
      if (/^<(local-command-caveat|bash-input|bash-stdout|bash-stderr|environment_details)>/i.test(userText.trim())) continue

      const steps: TraceStep[] = []
      let assistantMessage: string | undefined

      const visited = new Set<string>()
      let cur = userMsg.uuid as string

      while (cur) {
        visited.add(cur)

        // Only follow non-sidechain children; prefer them over sidechain
        const children = recs.filter(
          (r) => r.parentUuid === cur && !visited.has(r.uuid)
        )
        const child =
          children.find((c) => !c.isSidechain) ?? children[0]
        if (!child) break

        // Stop when we reach the next turn's user message (not a tool-result node)
        if (
          child.type === 'user' &&
          turnStarterUuids.has(child.uuid) &&
          child.uuid !== userMsg.uuid
        ) break

        cur = child.uuid

        if (child.type === 'assistant' && child.message) {
          const msgContent = child.message.content
          if (Array.isArray(msgContent)) {
            for (const item of msgContent) {
              if (item.type === 'text' && item.text) {
                assistantMessage = item.text
              } else if (item.type === 'thinking' && item.thinking) {
                steps.push({
                  id: `${cur}-thinking-${steps.length}`,
                  type: 'thinking',
                  text: item.thinking,
                })
              } else if (item.type === 'tool_use') {
                steps.push({
                  id: item.id || `${cur}-tool-${steps.length}`,
                  type: 'tool_use',
                  name: item.name,
                  input: item.input,
                })
              }
            }
          }
        } else if (child.type === 'user' && child.message?.role === 'user') {
          // tool_result nodes
          const childContent = child.message?.content
          if (Array.isArray(childContent)) {
            for (const item of childContent) {
              if (item.type === 'tool_result') {
                const out = item.content
                steps.push({
                  id: item.tool_use_id || `${cur}-result-${steps.length}`,
                  type: 'tool_result',
                  output: Array.isArray(out)
                    ? extractText(out)
                    : typeof out === 'string' ? out : '',
                  isError: item.is_error === true,
                })
              }
            }
          }
        }
      }

      turns.push({ id: `turn-${turnIndex++}`, userMessage: userText, steps, assistantMessage })
    }

    if (turns.length === 0) return null

    return { id: sessionId, source: 'claude', startedAt, cwd, projectPath, turns, filePath }
  } catch (err) {
    console.error(`Failed to parse Claude session ${filePath}:`, err)
    return null
  }
}
