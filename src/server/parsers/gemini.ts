import fs from 'fs'
import os from 'os'
import path from 'path'
import type { TraceSession, TraceTurn, TraceStep, TokenUsage } from '../../shared/types.js'

const GEMINI_DIR = path.join(os.homedir(), '.gemini', 'tmp')

export function parseGeminiSession(filePath: string): TraceSession | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)

    const sessionId = data.sessionId as string
    const startedAt = data.startTime as string

    // Extract cwd from projectHash or derive from path
    const projectSlug = filePath.split('/tmp/')[1]?.split('/chats/')[0] || ''
    const cwd = `~/.gemini/tmp/${projectSlug}`

    const messages = data.messages || []

    // Group into turns: each 'user' message starts a turn, followed by 'gemini' response
    const turns: TraceTurn[] = []
    let turnIndex = 0

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.type !== 'user') continue

      const userText = Array.isArray(msg.content)
        ? msg.content.map((c: { text?: string }) => c.text || '').join('\n')
        : typeof msg.content === 'string'
          ? msg.content
          : ''

      if (!userText.trim()) continue

      const steps: TraceStep[] = []
      let assistantMessage: string | undefined
      let tokenUsage: TokenUsage | undefined
      let model: string | undefined

      // Look for the next gemini response message
      for (let j = i + 1; j < messages.length; j++) {
        const resp = messages[j]
        if (resp.type === 'user') break // next user turn

        if (resp.type === 'gemini') {
          model = resp.model
          assistantMessage = typeof resp.content === 'string' ? resp.content : ''

          // Tool calls
          for (const tc of resp.toolCalls || []) {
            const callId = tc.id || `tool-${steps.length}`
            steps.push({
              id: `tool-${callId}`,
              type: 'tool_use',
              callId,
              name: tc.name,
              input: tc.args,
            })

            // Tool result is embedded in tc.result
            const result = tc.result
            if (result) {
              // result is array of functionResponse objects
              const outputs = Array.isArray(result)
                ? result
                    .map((r: { functionResponse?: { response?: { output?: string } } }) => {
                      return r?.functionResponse?.response?.output || ''
                    })
                    .filter(Boolean)
                    .join('\n')
                : ''

              if (outputs) {
                steps.push({
                  id: `result-${callId}`,
                  type: 'tool_result',
                  callId,
                  output: outputs,
                })
              }
            }
          }

          // Thoughts (shown as thinking steps)
          // Format: [{ subject, description }] or [{ parts: [{ text }] }]
          if (resp.thoughts && resp.thoughts.length > 0) {
            const thoughtText = resp.thoughts
              .map((t: { subject?: string; description?: string; parts?: { text?: string }[] }) => {
                if (t.description) {
                  return t.subject ? `**${t.subject}**\n${t.description}` : t.description
                }
                if (t.parts) {
                  return t.parts.map((p) => p.text || '').join('\n')
                }
                return ''
              })
              .filter(Boolean)
              .join('\n\n')
            if (thoughtText) {
              steps.unshift({
                id: `thought-${turnIndex}`,
                type: 'thinking',
                text: thoughtText,
              })
            }
          }

          // Token usage
          if (resp.tokens) {
            tokenUsage = {
              input: resp.tokens.input || 0,
              output: resp.tokens.output || 0,
              cached: resp.tokens.cached || 0,
              total: resp.tokens.total || 0,
            }
          }
        }
      }

      turns.push({
        id: `turn-${turnIndex++}`,
        userMessage: userText,
        steps,
        assistantMessage,
        tokenUsage,
      })
    }

    if (turns.length === 0) return null

    // Get model from first gemini response
    const firstGemini = messages.find((m: { type: string }) => m.type === 'gemini')
    const sessionModel = firstGemini?.model

    return {
      id: sessionId,
      source: 'gemini',
      startedAt,
      cwd,
      projectPath: projectSlug,
      model: sessionModel,
      turns,
      filePath,
    }
  } catch (err) {
    console.error(`Failed to parse Gemini session ${filePath}:`, err)
    return null
  }
}

export function listGeminiSessions(): string[] {
  const files: string[] = []
  if (!fs.existsSync(GEMINI_DIR)) return files

  for (const project of fs.readdirSync(GEMINI_DIR)) {
    const chatsDir = path.join(GEMINI_DIR, project, 'chats')
    if (!fs.existsSync(chatsDir)) continue
    for (const file of fs.readdirSync(chatsDir)) {
      if (file.endsWith('.json')) {
        files.push(path.join(chatsDir, file))
      }
    }
  }
  return files
}
