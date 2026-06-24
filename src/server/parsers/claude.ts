import fs from 'fs'
import os from 'os'
import path from 'path'
import { createInterface } from 'readline'
import type { SessionMeta, TraceSession, TraceTurn, TraceStep, TokenUsage } from '../../shared/types.js'
import { makeSessionTitle } from './sessionTitle.js'

const CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects')
const INTERNAL_USER_MESSAGE_RE = /^<(local-command-caveat|bash-input|bash-stdout|bash-stderr|environment_details)>/i
const LOCAL_COMMAND_OUTPUT_RE = /^<local-command-(stdout|stderr)>([\s\S]*)<\/local-command-\1>$/i
const TASK_NOTIFICATION_RE = /^<task-notification>\s*[\s\S]*<\/task-notification>$/i
const COMMAND_NAME_RE = /<command-name>([\s\S]*?)<\/command-name>/i
const COMMAND_ARGS_RE = /<command-args>([\s\S]*?)<\/command-args>/i
const HIDDEN_USER_CONTEXT_TAG_RE = /<(ide_opened_file|system-reminder)>[\s\S]*?<\/\1>/gi

type ClaudeRecord = {
  type?: string
  uuid?: string
  parentUuid?: string | null
  isSidechain?: boolean
  promptId?: string
  agentId?: string
  subtype?: string
  sessionId?: string
  cwd?: string
  timestamp?: string
  toolUseResult?: unknown
  hookCount?: number
  hookInfos?: { command?: string; durationMs?: number }[]
  hookErrors?: unknown[]
  durationMs?: number
  messageCount?: number
  isMeta?: boolean
  operation?: string
  content?: string
  level?: string
  message?: {
    role?: string
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
    content?: unknown
  }
}

type ClaudeUsage = NonNullable<NonNullable<ClaudeRecord['message']>['usage']>
type TaskNotification = {
  taskId?: string
  toolUseId?: string
  outputFile?: string
  status?: string
  summary?: string
}

function isPureToolResultContent(content: unknown): boolean {
  return Array.isArray(content) &&
    content.length > 0 &&
    content.every((item) => {
      const obj = item as Record<string, unknown>
      return obj.type === 'tool_result'
    })
}

function isTurnStarterRecord(record: ClaudeRecord): boolean {
  if (record.type !== 'user' || record.message?.role !== 'user') return false
  if (isPureToolResultContent(record.message?.content)) return false

  const rawText =
    typeof record.message?.content === 'string'
      ? record.message.content
      : Array.isArray(record.message?.content)
        ? extractText(record.message?.content)
        : ''
  const normalizedText = normalizeUserFacingText(rawText).trim()
  if (!normalizedText) return false
  if (INTERNAL_USER_MESSAGE_RE.test(rawText.trim())) return false
  if (isLocalCommandOutputText(rawText)) return false
  if (isTaskNotificationText(rawText)) return false
  if (record.isMeta) return false

  return true
}

function isInternalMetaRecord(record: ClaudeRecord | undefined): boolean {
  if (!record) return false
  if (record.isMeta) return true
  const content = typeof record.message?.content === 'string'
    ? record.message.content
    : Array.isArray(record.message?.content)
      ? extractText(record.message?.content)
      : ''
  return /^<local-command-caveat>/i.test(content.trim())
}

function getUserText(content: unknown): string {
  const raw =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? extractText(content)
        : ''
  return normalizeUserFacingText(raw)
}

function stringifyUnknown(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatStructuredToolUseResult(toolUseResult: unknown): string {
  if (!toolUseResult || typeof toolUseResult !== 'object') return ''

  const data = toolUseResult as Record<string, unknown>
  const stdout = typeof data.stdout === 'string' ? data.stdout : ''
  const stderr = typeof data.stderr === 'string' ? data.stderr : ''

  if (stdout || stderr) {
    const parts: string[] = []
    if (stdout) parts.push(`stdout:\n${stdout}`)
    if (stderr) parts.push(`stderr:\n${stderr}`)
    if (data.interrupted === true) parts.push('interrupted: true')
    return parts.join('\n\n')
  }

  // Read results already include the main file contents in tool_result.content.
  if ('file' in data && !('oldString' in data) && !('newString' in data) && !('structuredPatch' in data)) {
    return ''
  }

  if ('oldString' in data || 'newString' in data || 'structuredPatch' in data || 'filePath' in data) {
    return stringifyUnknown(data)
  }

  return ''
}

function extractTagContent(text: string, re: RegExp): string {
  return text.match(re)?.[1]?.trim() || ''
}

function formatCommandText(text: string): string | null {
  if (!COMMAND_NAME_RE.test(text)) return null
  const name = extractTagContent(text, COMMAND_NAME_RE)
  const args = extractTagContent(text, COMMAND_ARGS_RE)
  return [name, args].filter(Boolean).join(' ').trim() || name || null
}

function isTaskNotificationText(text: string): boolean {
  return TASK_NOTIFICATION_RE.test(text.trim())
}

function isLocalCommandOutputText(text: string): boolean {
  return LOCAL_COMMAND_OUTPUT_RE.test(text.trim())
}

function stripLocalCommandOutput(text: string): string {
  const match = text.trim().match(LOCAL_COMMAND_OUTPUT_RE)
  return match?.[2]?.trim() || text.trim()
}

function normalizeUserFacingText(text: string): string {
  const trimmed = text.replace(HIDDEN_USER_CONTEXT_TAG_RE, '').trim()
  const taskNotification = parseTaskNotification(trimmed)
  if (taskNotification) return formatTaskNotificationText(taskNotification)
  const command = formatCommandText(trimmed)
  if (command) return command
  if (isLocalCommandOutputText(trimmed)) return stripLocalCommandOutput(trimmed)
  return trimmed
}

function getClaudeSessionId(record: ClaudeRecord): string {
  const sessionId = record.sessionId || ''
  return record.isSidechain && record.agentId ? `${sessionId}:${record.agentId}` : sessionId
}

function parseTaskNotification(text: string): TaskNotification | null {
  if (!isTaskNotificationText(text)) return null

  return {
    taskId: extractTagContent(text, /<task-id>([\s\S]*?)<\/task-id>/i) || undefined,
    toolUseId: extractTagContent(text, /<tool-use-id>([\s\S]*?)<\/tool-use-id>/i) || undefined,
    outputFile: extractTagContent(text, /<output-file>([\s\S]*?)<\/output-file>/i) || undefined,
    status: extractTagContent(text, /<status>([\s\S]*?)<\/status>/i) || undefined,
    summary: extractTagContent(text, /<summary>([\s\S]*?)<\/summary>/i) || undefined,
  }
}

function formatTaskNotificationText(task: TaskNotification): string {
  const headerParts = [
    task.taskId ? `Task ${task.taskId}` : 'Task',
    task.status,
  ].filter(Boolean)
  const lines = [headerParts.join(' · ')]
  if (task.summary) lines.push(task.summary)
  if (task.toolUseId) lines.push(`Tool call: ${task.toolUseId}`)
  if (task.outputFile) lines.push(`Output: ${task.outputFile}`)
  return lines.join('\n')
}

function toTaskStep(task: TaskNotification, id: string): TraceStep {
  const status = task.status?.trim().toLowerCase()
  return {
    id,
    type: 'system',
    name: status ? `task_${status}` : 'task',
    callId: task.toolUseId,
    text: formatTaskNotificationText(task),
    isError: status === 'failed' || status === 'error',
  }
}

function formatToolResultOutput(content: unknown, toolUseResult: unknown): string {
  const base =
    Array.isArray(content)
      ? extractText(content)
      : typeof content === 'string'
        ? content
        : stringifyUnknown(content)

  const structured = formatStructuredToolUseResult(toolUseResult)
  if (!structured) return base
  if (!base) return structured
  if (structured === base) return base
  return `${base}\n\n--- structured ---\n${structured}`
}

function toTokenUsage(usage: ClaudeUsage | undefined): TokenUsage | undefined {
  if (!usage) return undefined
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cached = (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
  return {
    input,
    output,
    cached: cached || undefined,
    total: input + output,
  }
}

function summarizeSystemRecord(record: ClaudeRecord): { name: string; text: string } | null {
  const subtype = record.subtype || 'system'

  if (subtype === 'local_command') {
    return {
      name: subtype,
      text: normalizeUserFacingText(record.content || ''),
    }
  }

  if (subtype === 'turn_duration') {
    const parts: string[] = []
    if (typeof record.durationMs === 'number') parts.push(`Duration: ${record.durationMs} ms`)
    if (typeof record.messageCount === 'number') parts.push(`Messages: ${record.messageCount}`)
    return { name: subtype, text: parts.join('\n') || 'Turn completed.' }
  }

  if (subtype === 'stop_hook_summary') {
    const parts: string[] = []
    if (typeof record.hookCount === 'number') parts.push(`Hook count: ${record.hookCount}`)
    if (Array.isArray(record.hookInfos) && record.hookInfos.length > 0) {
      parts.push(...record.hookInfos.map((hook, index) => {
        const duration = typeof hook.durationMs === 'number' ? ` (${hook.durationMs} ms)` : ''
        return `Hook ${index + 1}: ${hook.command || 'unknown'}${duration}`
      }))
    }
    if (Array.isArray(record.hookErrors) && record.hookErrors.length > 0) {
      parts.push(`Errors:\n${stringifyUnknown(record.hookErrors)}`)
    }
    return { name: subtype, text: parts.join('\n') || 'Stop hooks ran.' }
  }

  if (subtype === 'file-history-snapshot') {
    return { name: subtype, text: 'File history snapshot updated.' }
  }

  if (subtype === 'away_summary') {
    return {
      name: subtype,
      text: record.content || 'Away summary updated.',
    }
  }

  return {
    name: subtype,
    text: stringifyUnknown(record),
  }
}

/** Fast meta-only read: streams the file once for session metadata + user turn count. */
export async function readClaudeMeta(filePath: string): Promise<SessionMeta | null> {
  try {
    const rl = createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })

    let sessionId = ''
    let cwd = ''
    let startedAt = ''
    let model = ''
    let turnCount = 0
    let eventCount = 0
    let toolCallCount = 0
    let firstUserText = ''
    const metaByUuid = new Map<string, boolean>()

    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj = JSON.parse(trimmed) as any

        if (!sessionId && obj.sessionId) {
          sessionId = getClaudeSessionId(obj)
        }

        if (obj.sessionId) {
          if (!cwd && obj.cwd) cwd = obj.cwd
          if (!startedAt && obj.timestamp) startedAt = obj.timestamp
        }

        if (!model && obj.type === 'assistant' && obj.message?.model) {
          model = obj.message.model
        }

        if (obj.type === 'assistant' && Array.isArray(obj.message?.content)) {
          for (const item of obj.message.content) {
            if (item?.type === 'tool_use') toolCallCount++
          }
        }

        if (obj.uuid) metaByUuid.set(obj.uuid, obj.isMeta === true)

        // Count user turns (non-tool-result user messages)
        if (obj.type === 'user' && obj.message?.role === 'user') {
          const content = obj.message.content
          if (!isPureToolResultContent(content)) {
            const rawText =
              typeof content === 'string'
                ? content
                : Array.isArray(content)
                  ? extractText(content)
                  : ''
            const text = normalizeUserFacingText(rawText)
            const parentIsMeta = typeof obj.parentUuid === 'string' && metaByUuid.get(obj.parentUuid) === true
            const isCommand = formatCommandText(rawText.trim())
            if (text.trim() && !INTERNAL_USER_MESSAGE_RE.test(rawText.trim()) && !isLocalCommandOutputText(rawText.trim()) && !isTaskNotificationText(rawText.trim()) && (!parentIsMeta || !!isCommand) && obj.isMeta !== true) {
              turnCount++
              if (!firstUserText) firstUserText = text
            }
          }
        }

        if (
          obj.type === 'assistant' ||
          obj.type === 'system' ||
          obj.type === 'queue-operation' ||
          obj.type === 'attachment' ||
          obj.type === 'file-history-snapshot'
        ) {
          eventCount++
        }

        if (obj.uuid && /^<local-command-caveat>/i.test((typeof obj.message?.content === 'string' ? obj.message.content : '').trim())) {
          metaByUuid.set(obj.uuid, true)
        }
      } catch {
        // skip
      }
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
      title: makeSessionTitle(firstUserText),
      summary: makeSessionTitle(firstUserText),
      eventCount: eventCount || undefined,
      toolCallCount: toolCallCount || undefined,
      model: model || undefined,
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

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry)
      let stat: fs.Stats
      try {
        stat = fs.statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (fullPath.endsWith('.jsonl')) {
        files.push(fullPath)
      }
    }
  }

  for (const project of fs.readdirSync(CLAUDE_DIR)) {
    const projectDir = path.join(CLAUDE_DIR, project)
    try {
      if (!fs.statSync(projectDir).isDirectory()) continue
      walk(projectDir)
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
      if (item.type === 'image' || item.type === 'image_url') return '[image]'
      if (item.type === 'document') return '[document]'
      if (item.type === 'tool_result') return ''
      if (typeof item.content === 'string') return item.content
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export async function parseClaudeSession(filePath: string): Promise<TraceSession | null> {
  try {
    const records = await readJsonLines(filePath)
    if (records.length === 0) return null

    const recs = records as ClaudeRecord[]
    const anyRecord = recs.find((r) => r.sessionId)
    if (!anyRecord) return null

    const sessionId = getClaudeSessionId(anyRecord)
    const cwd = recs.find((r) => r.cwd)?.cwd || ''
    const startedAt = recs.find((r) => r.timestamp)?.timestamp || ''
    const projectPath = filePath.split('/projects/')[1]?.split('/')[0]?.replace(/-/g, '/')
    const model = recs.find((r) => r.type === 'assistant' && r.message?.model)?.message?.model as string | undefined
    const eventCount = recs.filter((r) =>
      r.type === 'assistant' ||
      r.type === 'system' ||
      r.type === 'queue-operation' ||
      r.type === 'attachment' ||
      r.type === 'file-history-snapshot'
    ).length
    const toolCallCount = recs.reduce((count, record) => {
      if (record.type !== 'assistant' || !Array.isArray(record.message?.content)) return count
      return count + record.message.content.filter((item) => {
        const block = item as Record<string, unknown>
        return block.type === 'tool_use'
      }).length
    }, 0)

    const indexedRecs = recs.map((record, index) => ({ ...record, _index: index }))
    const recordByUuid = new Map(indexedRecs.filter((record) => record.uuid).map((record) => [record.uuid as string, record]))
    const childrenByParent = new Map<string, Array<ClaudeRecord & { _index: number }>>()
    for (const record of indexedRecs) {
      if (!record.parentUuid) continue
      const siblings = childrenByParent.get(record.parentUuid) || []
      siblings.push(record)
      childrenByParent.set(record.parentUuid, siblings)
    }
    for (const siblings of childrenByParent.values()) {
      siblings.sort((a, b) => a._index - b._index)
    }

    // Identify turn-starter user messages: user nodes whose content is NOT purely tool_results
    const turnStarterUuids = new Set<string>()
    const userMessages: Array<ClaudeRecord & { _index: number }> = []
    for (const r of indexedRecs) {
      const rawText =
        typeof r.message?.content === 'string'
          ? r.message.content
          : Array.isArray(r.message?.content)
            ? extractText(r.message?.content)
            : ''
      const parent = r.parentUuid ? recordByUuid.get(r.parentUuid) : undefined
      const isCommand = !!formatCommandText(rawText.trim())
      const isStarter = isTurnStarterRecord(r) && (!isInternalMetaRecord(parent) || isCommand)
      if (r.uuid && isStarter) {
        turnStarterUuids.add(r.uuid)
        userMessages.push(r)
      }
    }

    const turns: TraceTurn[] = []
    let turnIndex = 0

    for (const userMsg of userMessages) {
      const content = userMsg.message?.content
      const userText = getUserText(content)
      if (!userText.trim()) continue
      // Skip internal system messages injected by the shell/tool context
      if (INTERNAL_USER_MESSAGE_RE.test(userText.trim())) continue

      const steps: TraceStep[] = []
      let tokenUsage: TokenUsage | undefined

      const queue = [...(childrenByParent.get(userMsg.uuid as string) || [])]
      const collected: Array<ClaudeRecord & { _index: number }> = []
      const seen = new Set<string>()

      while (queue.length > 0) {
        const node = queue.shift()
        if (!node?.uuid || seen.has(node.uuid)) continue

        if (
          node.type === 'user' &&
          turnStarterUuids.has(node.uuid) &&
          node.uuid !== userMsg.uuid
        ) {
          continue
        }

        seen.add(node.uuid)
        collected.push(node)

        const children = childrenByParent.get(node.uuid) || []
        for (const child of children) queue.push(child)
      }

      collected.sort((a, b) => a._index - b._index)

      for (const record of collected) {
        if (record.type === 'assistant' && record.message) {
          tokenUsage = toTokenUsage(record.message.usage) || tokenUsage
          const msgContent = record.message.content

          if (typeof msgContent === 'string' && msgContent.trim()) {
            steps.push({
              id: `${record.uuid}-text-0`,
              type: 'text',
              text: msgContent,
            })
            continue
          }

          if (!Array.isArray(msgContent)) continue

          msgContent.forEach((item, index) => {
            const block = item as Record<string, unknown>

            if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
              steps.push({
                id: `${record.uuid}-text-${index}`,
                type: 'text',
                text: block.text,
              })
              return
            }

            if (block.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) {
              steps.push({
                id: `${record.uuid}-thinking-${index}`,
                type: 'thinking',
                text: block.thinking,
              })
              return
            }

            if (block.type === 'tool_use') {
              const callId = typeof block.id === 'string' ? block.id : undefined
              steps.push({
                id: `tool-${callId || `${record.uuid}-${index}`}`,
                type: 'tool_use',
                callId,
                name: typeof block.name === 'string' ? block.name : undefined,
                input: typeof block.input === 'object' && block.input !== null
                  ? block.input as Record<string, unknown>
                  : undefined,
              })
            }
          })
          continue
        }

        if (record.type === 'user' && record.message?.role === 'user' && Array.isArray(record.message.content)) {
          record.message.content.forEach((item, index) => {
            const block = item as Record<string, unknown>
            if (block.type !== 'tool_result') return
            const callId = typeof block.tool_use_id === 'string' ? block.tool_use_id : undefined
            steps.push({
              id: `result-${callId || `${record.uuid}-${index}`}`,
              type: 'tool_result',
              callId,
              output: formatToolResultOutput(block.content, record.toolUseResult),
              isError: block.is_error === true,
            })
          })
          continue
        }

        if (record.type === 'user' && record.message?.role === 'user') {
          const rawText =
            typeof record.message.content === 'string'
              ? record.message.content
              : ''
          const taskNotification = parseTaskNotification(rawText)
          if (taskNotification) {
            steps.push(toTaskStep(taskNotification, record.uuid || `task-${steps.length}`))
            continue
          }
          const normalizedText = normalizeUserFacingText(rawText)
          if (!normalizedText || INTERNAL_USER_MESSAGE_RE.test(rawText.trim()) || record.isMeta) continue
          if (record.uuid === userMsg.uuid) continue

          steps.push({
            id: record.uuid || `user-${steps.length}`,
            type: 'system',
            name: 'local_command',
            text: normalizedText,
          })
          continue
        }

        if (record.type === 'queue-operation') {
          const taskNotification = parseTaskNotification(record.content || '')
          if (taskNotification) {
            steps.push(toTaskStep(taskNotification, record.uuid || `queue-${steps.length}`))
          }
          continue
        }

        if (record.type === 'attachment') {
          steps.push({
            id: record.uuid || `attachment-${steps.length}`,
            type: 'system',
            name: 'attachment',
            text: stringifyUnknown((record as unknown as { attachment?: unknown }).attachment),
          })
          continue
        }

        if (record.type === 'file-history-snapshot') {
          steps.push({
            id: record.uuid || `file-history-${steps.length}`,
            type: 'system',
            name: 'file-history-snapshot',
            text: 'File history snapshot updated.',
          })
          continue
        }

        if (record.type === 'system') {
          const taskNotification = parseTaskNotification(record.content || '')
          if (taskNotification) {
            steps.push(toTaskStep(taskNotification, record.uuid || `task-${steps.length}`))
            continue
          }
          const system = summarizeSystemRecord(record)
          if (system) {
            steps.push({
              id: record.uuid || `system-${steps.length}`,
              type: 'system',
              name: system.name,
              text: system.text,
            })
          }
        }
      }

      let assistantMessage: string | undefined
      const displaySteps = [...steps]
      const trailingTextParts: string[] = []

      while (displaySteps.length > 0) {
        const lastStep = displaySteps[displaySteps.length - 1]
        if (lastStep.type !== 'text' || !lastStep.text) break
        trailingTextParts.unshift(lastStep.text)
        displaySteps.pop()
      }

      if (trailingTextParts.length > 0) {
        assistantMessage = trailingTextParts.join('\n\n')
      }

      turns.push({
        id: `turn-${turnIndex++}`,
        userMessage: userText,
        steps: displaySteps,
        assistantMessage,
        tokenUsage,
      })
    }

    if (turns.length === 0) return null

    const title = makeSessionTitle(turns[0]?.userMessage)

    return {
      id: sessionId,
      source: 'claude',
      startedAt,
      cwd,
      projectPath,
      title,
      summary: title,
      eventCount: eventCount || undefined,
      toolCallCount: toolCallCount || undefined,
      model,
      turns,
      filePath,
    }
  } catch (err) {
    console.error(`Failed to parse Claude session ${filePath}:`, err)
    return null
  }
}
