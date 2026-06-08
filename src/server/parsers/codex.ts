import fs from 'fs'
import os from 'os'
import path from 'path'
import { createInterface } from 'readline'
import type { TraceSession, TraceTurn, TraceStep, TokenUsage, SessionMeta } from '../../shared/types.js'
import { makeSessionTitle } from './sessionTitle.js'

const CODEX_DIR = path.join(os.homedir(), '.codex', 'sessions')

/** Fast meta-only read: reads first few lines for session_meta + counts task_started events */
export async function readCodexMeta(filePath: string): Promise<SessionMeta | null> {
  try {
    const rl = createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })
    let meta: SessionMeta | null = null
    let turnCount = 0
    let eventCount = 0
    let toolCallCount = 0
    let firstUserMessage = ''

    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj = JSON.parse(trimmed) as any
        if (obj.type === 'session_meta' && !meta) {
          meta = {
            id: obj.payload?.id || '',
            source: 'codex',
            startedAt: obj.payload?.timestamp || obj.timestamp || '',
            cwd: obj.payload?.cwd || '',
            model: obj.payload?.model_provider,
            turnCount: 0,
            filePath,
          }
        }
        if (obj.type === 'event_msg' && obj.payload?.type === 'task_started') {
          turnCount++
        }
        if (obj.type === 'event_msg' && obj.payload?.type === 'user_message' && !firstUserMessage) {
          firstUserMessage = obj.payload?.message || ''
        }
        if (obj.type === 'response_item') {
          eventCount++
          if (
            obj.payload?.type === 'function_call' ||
            obj.payload?.type === 'custom_tool_call' ||
            obj.payload?.type === 'web_search_call'
          ) {
            toolCallCount++
          }
        }
      } catch { /* skip */ }
    }
    rl.close()
    if (!meta) return null
    meta.turnCount = turnCount
    meta.title = makeSessionTitle(firstUserMessage)
    meta.summary = meta.title
    meta.eventCount = eventCount || undefined
    meta.toolCallCount = toolCallCount || undefined
    return meta
  } catch {
    return null
  }
}

async function readJsonLines(filePath: string): Promise<unknown[]> {
  const lines: unknown[] = []
  const rl = createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      lines.push(JSON.parse(trimmed))
    } catch {
      // skip malformed
    }
  }
  return lines
}

export async function parseCodexSession(filePath: string): Promise<TraceSession | null> {
  try {
    const records = await readJsonLines(filePath)
    if (records.length === 0) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recs = records as any[]

    const metaRecord = recs.find((r) => r.type === 'session_meta')
    if (!metaRecord) return null

    const sessionId = metaRecord.payload?.id as string
    const cwd = metaRecord.payload?.cwd as string
    const startedAt = metaRecord.payload?.timestamp as string
    const model = metaRecord.payload?.model_provider as string
    const eventCount = recs.filter((r) => r.type === 'response_item').length
    const toolCallCount = recs.filter((r) =>
      r.type === 'response_item' &&
      (
        r.payload?.type === 'function_call' ||
        r.payload?.type === 'custom_tool_call' ||
        r.payload?.type === 'web_search_call'
      )
    ).length

    // Group records into turns using event_msg task_started/task_complete
    const turns: TraceTurn[] = []
    let turnIndex = 0

    // Collect event_msgs
    const eventMsgs = recs.filter((r) => r.type === 'event_msg')

    // Find all task_started indices
    const taskBoundaries: number[] = []
    for (let i = 0; i < eventMsgs.length; i++) {
      if (eventMsgs[i].payload?.type === 'task_started') {
        taskBoundaries.push(i)
      }
    }

    for (let b = 0; b < taskBoundaries.length; b++) {
      const start = taskBoundaries[b]
      const end = b + 1 < taskBoundaries.length ? taskBoundaries[b + 1] : eventMsgs.length

      const turnEvents = eventMsgs.slice(start, end)

      const userMsgEvent = turnEvents.find((e) => e.payload?.type === 'user_message')
      const userMessage: string = userMsgEvent?.payload?.message || ''

      if (!userMessage.trim()) continue

      const steps: TraceStep[] = []
      let assistantMessage: string | undefined
      let tokenUsage: TokenUsage | undefined

      // Get the turn_id from task_started
      const turnId = eventMsgs[start]?.payload?.turn_id as string

      // Get response_items for this turn (by matching timestamp roughly or collecting all tool-related ones)
      // Response items are interleaved — collect assistant response_items between task_started and task_complete
      const taskStartedTs = eventMsgs[start].timestamp
      const taskCompleteEvent = turnEvents.find((e) => e.payload?.type === 'task_complete')
      const taskCompleteTs = taskCompleteEvent?.timestamp

      const responseItems = recs.filter((r) => {
        if (r.type !== 'response_item') return false
        if (r.timestamp < taskStartedTs) return false
        if (taskCompleteTs && r.timestamp > taskCompleteTs) return false
        return true
      })

      // Extract steps from response_items
      // response_item.payload.type is the discriminator (not payload.role)
      for (const ri of responseItems) {
        const payload = ri.payload
        if (!payload) continue

        // function_call: tool invocation
        if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
          const callId = payload.call_id || `call-${steps.length}`
          steps.push({
            id: `tool-${callId}`,
            type: 'tool_use',
            callId,
            name: payload.name,
            input:
              typeof payload.arguments === 'string'
                ? (() => { try { return JSON.parse(payload.arguments) } catch { return { raw: payload.arguments } } })()
                : payload.arguments || payload.input,
          })
        }

        // function_call_output / custom_tool_call_output: tool result
        if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
          const callId = payload.call_id || `call-${steps.length}`
          steps.push({
            id: `result-${callId}`,
            type: 'tool_result',
            callId,
            output:
              typeof payload.output === 'string'
                ? payload.output
                : JSON.stringify(payload.output),
          })
        }

        // reasoning: encrypted thinking — show summary text if available
        if (payload.type === 'reasoning') {
          const summaryText = (payload.summary || [])
            .map((s: { text?: string }) => s.text || '')
            .filter(Boolean)
            .join('\n')
          if (summaryText) {
            steps.push({
              id: `reasoning-${steps.length}`,
              type: 'thinking',
              text: summaryText,
            })
          }
        }
      }

      // agent_reasoning events → thinking steps (prepend before tool calls)
      const reasoningEvents = turnEvents.filter((e) => e.payload?.type === 'agent_reasoning')
      for (const re of reasoningEvents) {
        const text = re.payload?.text as string | undefined
        if (text?.trim()) {
          steps.unshift({
            id: `agent-reasoning-${steps.length}`,
            type: 'thinking',
            text,
          })
        }
      }

      // Get final assistant message from agent_message events
      const agentMessages = turnEvents.filter((e) => e.payload?.type === 'agent_message')
      const lastAgentMsg = agentMessages[agentMessages.length - 1]
      if (lastAgentMsg?.payload?.message) {
        assistantMessage = lastAgentMsg.payload.message
      }
      // Also check task_complete last_agent_message
      if (taskCompleteEvent?.payload?.last_agent_message) {
        assistantMessage = taskCompleteEvent.payload.last_agent_message
      }

      // Token usage
      const tokenEvent = turnEvents.find((e) => e.payload?.type === 'token_count')
      if (tokenEvent?.payload?.info?.last_token_usage) {
        const u = tokenEvent.payload.info.last_token_usage
        tokenUsage = {
          input: u.input_tokens,
          output: u.output_tokens,
          cached: u.cached_input_tokens,
          total: u.total_tokens,
        }
      }

      turns.push({
        id: turnId || `turn-${turnIndex}`,
        userMessage,
        steps,
        assistantMessage,
        tokenUsage,
      })
      turnIndex++
    }

    if (turns.length === 0) return null

    return {
      id: sessionId,
      source: 'codex',
      startedAt,
      cwd,
      title: makeSessionTitle(turns[0]?.userMessage),
      summary: makeSessionTitle(turns[0]?.userMessage),
      eventCount: eventCount || undefined,
      toolCallCount: toolCallCount || undefined,
      model,
      turns,
      filePath,
    }
  } catch (err) {
    console.error(`Failed to parse Codex session ${filePath}:`, err)
    return null
  }
}

export function listCodexSessions(): string[] {
  const files: string[] = []
  if (!fs.existsSync(CODEX_DIR)) return files

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        walk(full)
      } else if (full.endsWith('.jsonl')) {
        files.push(full)
      }
    }
  }

  walk(CODEX_DIR)
  return files
}
