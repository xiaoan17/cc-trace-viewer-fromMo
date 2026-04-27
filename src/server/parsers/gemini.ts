import fs from 'fs'
import os from 'os'
import path from 'path'
import type { TraceSession, TraceTurn, TraceStep, TokenUsage } from '../../shared/types.js'

const GEMINI_DIR = path.join(os.homedir(), '.gemini', 'tmp')

type GeminiSessionHeader = {
  sessionId?: string
  startTime?: string
  directories?: string[]
}

type GeminiTokens = {
  input?: number
  output?: number
  cached?: number
  total?: number
}

type GeminiToolCall = {
  id?: string
  name?: string
  args?: unknown
  result?: unknown
  resultDisplay?: unknown
  status?: string
}

type GeminiMessage = {
  id?: string
  timestamp?: string
  type?: string
  content?: unknown
  thoughts?: unknown[]
  tokens?: GeminiTokens | null
  model?: string
  toolCalls?: GeminiToolCall[]
}

type ParsedGeminiFile = {
  header: GeminiSessionHeader
  messages: GeminiMessage[]
}

export function parseGeminiSession(filePath: string): TraceSession | null {
  try {
    const { header, messages } = parseGeminiFile(filePath)
    const sessionId = header.sessionId
    const startedAt = header.startTime

    if (!sessionId || !startedAt) return null

    const projectDir = findGeminiProjectDir(filePath)
    const projectSlug = path.basename(projectDir)
    const cwd = header.directories?.[0] || readProjectRoot(projectDir) || `~/.gemini/tmp/${projectSlug}`
    const turns = buildTurns(messages)
    if (turns.length === 0) {
      const systemTurn = buildSystemOnlyTurn(messages)
      if (systemTurn) turns.push(systemTurn)
    }

    if (turns.length === 0) return null

    const sessionModel = messages.find((message) => message.type === 'gemini' && message.model)?.model

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

function parseGeminiFile(filePath: string): ParsedGeminiFile {
  return filePath.endsWith('.jsonl')
    ? parseGeminiJsonl(filePath)
    : parseGeminiJson(filePath)
}

function parseGeminiJson(filePath: string): ParsedGeminiFile {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw) as GeminiSessionHeader & { messages?: unknown }
  return {
    header: {
      sessionId: data.sessionId,
      startTime: data.startTime,
      directories: Array.isArray(data.directories) ? data.directories.filter(isString) : undefined,
    },
    messages: Array.isArray(data.messages)
      ? data.messages.filter(isRecord).map(normalizeGeminiMessage).filter(isGeminiMessage)
      : [],
  }
}

function parseGeminiJsonl(filePath: string): ParsedGeminiFile {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let header: GeminiSessionHeader = {}
  const messages: GeminiMessage[] = []
  const messageIndexById = new Map<string, number>()

  for (const line of lines) {
    const record = JSON.parse(line) as Record<string, unknown>

    if (isSessionHeader(record)) {
      header = {
        sessionId: header.sessionId || asString(record.sessionId),
        startTime: header.startTime || asString(record.startTime),
        directories: header.directories || (Array.isArray(record.directories) ? record.directories.filter(isString) : undefined),
      }
      continue
    }

    if (isSetRecord(record)) {
      header = mergeHeaderFromSet(header, record.$set)
      continue
    }

    const message = normalizeGeminiMessage(record)
    if (!message) continue
    const id = message.id

    if (id && messageIndexById.has(id)) {
      const index = messageIndexById.get(id) as number
      messages[index] = mergeMessage(messages[index], message)
      continue
    }

    if (id) messageIndexById.set(id, messages.length)
    messages.push(message)
  }

  return { header, messages }
}

function buildTurns(messages: GeminiMessage[]): TraceTurn[] {
  const turns: TraceTurn[] = []
  let turnIndex = 0

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (message.type !== 'user') continue

    const userMessage = extractText(message.content).trim()
    if (!userMessage) continue

    const steps: TraceStep[] = []
    let tokenUsage: TokenUsage | undefined
    let assistantMessage: string | undefined

    for (let j = i + 1; j < messages.length; j++) {
      const next = messages[j]
      if (next.type === 'user') break

      if (next.type === 'gemini') {
        tokenUsage = toTokenUsage(next.tokens) || tokenUsage

        const thoughts = formatThoughts(next.thoughts)
        const text = extractText(next.content).trim()
        const toolCalls = next.toolCalls || []

        if (thoughts) {
          steps.push({
            id: `${next.id || `gemini-${j}`}-thinking`,
            type: 'thinking',
            ...(next.timestamp ? { timestamp: next.timestamp } : {}),
            text: thoughts,
          })
        }

        if (text) {
          steps.push({
            id: `${next.id || `gemini-${j}`}-text`,
            type: 'text',
            ...(next.timestamp ? { timestamp: next.timestamp } : {}),
            text,
          })
        }

        for (const toolCall of toolCalls) {
          const callId = toolCall.id || `tool-${turnIndex}-${steps.length}`
          steps.push({
            id: `tool-${callId}`,
            type: 'tool_use',
            ...(next.timestamp ? { timestamp: next.timestamp } : {}),
            callId,
            name: toolCall.name,
            input: toInputRecord(toolCall.args),
          })

          const output = formatToolResult(toolCall.result, toolCall.resultDisplay)
          if (!output) continue

          steps.push({
            id: `result-${callId}`,
            type: 'tool_result',
            ...(next.timestamp ? { timestamp: next.timestamp } : {}),
            callId,
            output,
            isError: isToolCallError(toolCall),
          })
        }

        continue
      }

      if (next.type === 'info' || next.type === 'error') {
        const text = extractText(next.content).trim()
        if (!text) continue

        steps.push({
          id: next.id || `${next.type}-${turnIndex}-${steps.length}`,
          type: 'system',
          ...(next.timestamp ? { timestamp: next.timestamp } : {}),
          name: next.type,
          text,
          isError: next.type === 'error',
        })
      }
    }

    const displaySteps = [...steps]
    const trailingTextParts: string[] = []
    let trailingIndex = displaySteps.length - 1
    while (trailingIndex >= 0 && displaySteps[trailingIndex].type === 'system') {
      trailingIndex--
    }
    while (trailingIndex >= 0) {
      const step = displaySteps[trailingIndex]
      if (step.type !== 'text' || !step.text) break
      trailingTextParts.unshift(step.text)
      displaySteps.splice(trailingIndex, 1)
      trailingIndex--
    }
    if (trailingTextParts.length > 0) {
      assistantMessage = trailingTextParts.join('\n\n')
    }

    turns.push({
      id: `turn-${turnIndex++}`,
      userMessage,
      ...(message.timestamp ? { startedAt: message.timestamp } : {}),
      steps: displaySteps,
      assistantMessage,
      tokenUsage,
    })
  }

  return turns
}

function buildSystemOnlyTurn(messages: GeminiMessage[]): TraceTurn | null {
  const steps = messages
    .filter((message) => message.type === 'info' || message.type === 'error')
    .map((message, index): TraceStep | null => {
      const text = extractText(message.content).trim()
      if (!text) return null

      return {
        id: message.id || `${message.type}-event-${index}`,
        type: 'system',
        ...(message.timestamp ? { timestamp: message.timestamp } : {}),
        name: message.type,
        text,
        isError: message.type === 'error',
      }
    })
    .filter(isTraceStep)

  if (steps.length === 0) return null

  return {
    id: 'turn-events',
    userMessage: 'Session events',
    steps,
  }
}

function readProjectRoot(projectDir: string): string | null {
  const projectRootFile = path.join(projectDir, '.project_root')
  if (!fs.existsSync(projectRootFile)) return null

  const projectRoot = fs.readFileSync(projectRootFile, 'utf-8').trim()
  return projectRoot || null
}

function findGeminiProjectDir(filePath: string): string {
  const relativeParts = path.relative(GEMINI_DIR, filePath).split(path.sep)
  if (relativeParts.length > 1 && relativeParts[0] && !relativeParts[0].startsWith('..')) {
    return path.join(GEMINI_DIR, relativeParts[0])
  }

  const parts = filePath.split(path.sep)
  const chatsIndex = parts.lastIndexOf('chats')
  if (chatsIndex > 0) {
    return parts.slice(0, chatsIndex).join(path.sep) || path.sep
  }

  return path.dirname(path.dirname(filePath))
}

function isSessionHeader(value: Record<string, unknown>): boolean {
  return typeof value.sessionId === 'string' && typeof value.startTime === 'string'
}

function isSetRecord(value: Record<string, unknown>): value is { $set: Record<string, unknown> } {
  return isRecord(value.$set)
}

function mergeHeaderFromSet(header: GeminiSessionHeader, set: Record<string, unknown>): GeminiSessionHeader {
  return {
    sessionId: header.sessionId || asString(set.sessionId),
    startTime: header.startTime || asString(set.startTime),
    directories: header.directories || (Array.isArray(set.directories) ? set.directories.filter(isString) : undefined),
  }
}

function normalizeGeminiMessage(value: Record<string, unknown>): GeminiMessage | null {
  if (typeof value.type !== 'string') return null

  return {
    id: asString(value.id),
    timestamp: asString(value.timestamp),
    type: value.type,
    content: value.content,
    thoughts: Array.isArray(value.thoughts) ? value.thoughts : undefined,
    tokens: isRecord(value.tokens) ? value.tokens as GeminiTokens : value.tokens === null ? null : undefined,
    model: asString(value.model),
    toolCalls: Array.isArray(value.toolCalls)
      ? value.toolCalls.filter(isRecord).map(normalizeToolCall)
      : undefined,
  }
}

function isGeminiMessage(value: GeminiMessage | null): value is GeminiMessage {
  return value !== null
}

function isTraceStep(value: TraceStep | null): value is TraceStep {
  return value !== null
}

function normalizeToolCall(value: Record<string, unknown>): GeminiToolCall {
  return {
    id: asString(value.id),
    name: asString(value.name),
    args: value.args,
    result: value.result,
    resultDisplay: value.resultDisplay,
    status: asString(value.status),
  }
}

function mergeMessage(previous: GeminiMessage, incoming: GeminiMessage): GeminiMessage {
  return {
    ...previous,
    ...incoming,
    content: incoming.content ?? previous.content,
    thoughts: incoming.thoughts ?? previous.thoughts,
    tokens: incoming.tokens ?? previous.tokens,
    model: incoming.model ?? previous.model,
    toolCalls: mergeToolCalls(previous.toolCalls, incoming.toolCalls),
  }
}

function mergeToolCalls(previous: GeminiToolCall[] | undefined, incoming: GeminiToolCall[] | undefined): GeminiToolCall[] | undefined {
  if (!previous) return incoming
  if (!incoming) return previous

  const merged = [...previous]
  const indexById = new Map<string, number>()
  for (let i = 0; i < merged.length; i++) {
    if (merged[i].id) indexById.set(merged[i].id as string, i)
  }

  for (const toolCall of incoming) {
    if (toolCall.id && indexById.has(toolCall.id)) {
      const index = indexById.get(toolCall.id) as number
      merged[index] = { ...merged[index], ...toolCall }
    } else {
      merged.push(toolCall)
    }
  }

  return merged
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => extractText(item))
      .filter(Boolean)
      .join('\n')
  }
  if (!content || typeof content !== 'object') return ''

  const data = content as Record<string, unknown>
  if (typeof data.text === 'string') return data.text
  if (Array.isArray(data.parts)) return extractText(data.parts)
  if (typeof data.value === 'string') return data.value
  if (typeof data.output === 'string') return data.output
  if (typeof data.error === 'string') return data.error

  return ''
}

function formatThoughts(thoughts: unknown): string {
  if (!Array.isArray(thoughts) || thoughts.length === 0) return ''

  return thoughts
    .map((thought) => {
      if (!thought || typeof thought !== 'object') return ''

      const data = thought as {
        subject?: unknown
        description?: unknown
        parts?: Array<{ text?: unknown }>
      }

      if (typeof data.description === 'string' && data.description.trim()) {
        return typeof data.subject === 'string' && data.subject.trim()
          ? `**${data.subject}**\n${data.description}`
          : data.description
      }

      if (!Array.isArray(data.parts)) return ''
      return data.parts
        .map((part) => typeof part?.text === 'string' ? part.text : '')
        .filter(Boolean)
        .join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}

function formatToolResult(result: unknown, resultDisplay: unknown): string {
  const output = formatToolResultEntries(result)
  if (output) return output

  const displayOutput = formatResultDisplay(resultDisplay)
  if (displayOutput) return displayOutput

  return stringifyUnknown(result)
}

function formatToolResultEntries(result: unknown): string {
  if (!Array.isArray(result)) return ''
  return result
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return stringifyUnknown(entry)

      const functionResponse = (entry as { functionResponse?: unknown }).functionResponse
      if (!functionResponse || typeof functionResponse !== 'object') return stringifyUnknown(entry)

      const response = (functionResponse as { response?: unknown }).response
      if (!response || typeof response !== 'object') return stringifyUnknown(functionResponse)

      if (typeof (response as { output?: unknown }).output === 'string') {
        return (response as { output: string }).output
      }

      if (typeof (response as { error?: unknown }).error === 'string') {
        return (response as { error: string }).error
      }

      return stringifyUnknown(response)
    })
    .filter(Boolean)
    .join('\n\n')
}

function formatResultDisplay(resultDisplay: unknown): string {
  if (!Array.isArray(resultDisplay)) return stringifyUnknown(resultDisplay)

  const lines = resultDisplay
    .map((line) => {
      if (!Array.isArray(line)) return extractText(line)
      return line
        .map((segment) => {
          if (typeof segment === 'string') return segment
          if (!segment || typeof segment !== 'object') return ''
          const text = (segment as { text?: unknown }).text
          return typeof text === 'string' ? text : ''
        })
        .join('')
        .trimEnd()
    })
    .filter(Boolean)

  return lines.join('\n')
}

function isToolCallError(toolCall: GeminiToolCall): boolean {
  const status = toolCall.status?.toLowerCase()
  return status === 'error' || status === 'cancelled' || status === 'failed'
}

function toInputRecord(value: unknown): Record<string, unknown> | undefined {
  if (value == null) return undefined
  if (isRecord(value)) return value
  return { value }
}

function toTokenUsage(tokens: GeminiTokens | null | undefined): TokenUsage | undefined {
  if (!tokens) return undefined

  const input = tokens.input ?? 0
  const output = tokens.output ?? 0
  const cached = tokens.cached ?? 0
  const total = tokens.total ?? input + output

  return {
    input,
    output,
    cached,
    total,
  }
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

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function listGeminiSessions(): string[] {
  const files: string[] = []
  if (!fs.existsSync(GEMINI_DIR)) return files

  for (const project of fs.readdirSync(GEMINI_DIR)) {
    const chatsDir = path.join(GEMINI_DIR, project, 'chats')
    if (!fs.existsSync(chatsDir)) continue

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath)
        } else if (fullPath.endsWith('.json') || fullPath.endsWith('.jsonl')) {
          files.push(fullPath)
        }
      }
    }

    walk(chatsDir)
  }

  return files
}
