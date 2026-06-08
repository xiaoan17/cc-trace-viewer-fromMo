import fs from 'fs'
import os from 'os'
import path from 'path'
import { createInterface } from 'readline'
import type { SessionMeta, TraceSession, TraceStep, TraceTurn, TokenUsage } from '../../shared/types.js'
import { makeSessionTitle } from './sessionTitle.js'

const KIMI_DIR = path.join(os.homedir(), '.kimi-code')
const KIMI_SESSIONS_DIR = path.join(KIMI_DIR, 'sessions')
const KIMI_INDEX_FILE = path.join(KIMI_DIR, 'session_index.jsonl')

type KimiState = {
  createdAt?: string
  updatedAt?: string
  title?: string
  lastPrompt?: string
}

type KimiIndexRecord = {
  sessionId?: string
  sessionDir?: string
  workDir?: string
}

type KimiUsage = {
  inputOther?: number
  output?: number
  inputCacheRead?: number
  inputCacheCreation?: number
}

type KimiRecord = {
  type?: string
  time?: number
  created_at?: number
  modelAlias?: string
  model?: string
  input?: unknown
  usage?: KimiUsage
  message?: {
    role?: string
    content?: unknown
  }
  event?: {
    type?: string
    uuid?: string
    parentUuid?: string
    turnId?: string | number | null
    step?: number
    stepUuid?: string
    toolCallId?: string
    name?: string
    args?: unknown
    description?: string
    part?: unknown
    result?: unknown
    usage?: KimiUsage
  }
}

type KimiSessionFiles = {
  sessionDir: string
  statePath: string
  wirePath: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
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

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => extractText(item))
      .filter(Boolean)
      .join('\n')
  }
  if (!isRecord(content)) return ''

  if (typeof content.text === 'string') return content.text
  if (typeof content.content === 'string') return content.content
  if (typeof content.output === 'string') return content.output
  if (typeof content.think === 'string') return content.think
  if (Array.isArray(content.parts)) return extractText(content.parts)
  return ''
}

function toInputRecord(value: unknown): Record<string, unknown> | undefined {
  if (value == null) return undefined
  if (isRecord(value)) return value
  return { value }
}

function toIsoTime(value: number | undefined, fallback?: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }
  return fallback || ''
}

function toTokenUsage(usage: KimiUsage | undefined): TokenUsage | undefined {
  if (!usage) return undefined

  const input = (usage.inputOther ?? 0) + (usage.inputCacheRead ?? 0) + (usage.inputCacheCreation ?? 0)
  const output = usage.output ?? 0
  const cached = usage.inputCacheRead ?? 0

  return {
    input,
    output,
    cached: cached || undefined,
    total: input + output,
  }
}

function mergeUsage(current: TokenUsage | undefined, usage: KimiUsage | undefined): TokenUsage | undefined {
  const next = toTokenUsage(usage)
  if (!next) return current
  if (!current) return next

  return {
    input: current.input + next.input,
    output: current.output + next.output,
    cached: (current.cached ?? 0) + (next.cached ?? 0) || undefined,
    total: (current.total ?? current.input + current.output) + (next.total ?? next.input + next.output),
  }
}

function readState(statePath: string): KimiState | null {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8')) as KimiState
  } catch {
    return null
  }
}

function getSessionId(sessionDir: string): string {
  return path.basename(sessionDir)
}

function getMainWirePath(sessionDir: string): string {
  return path.join(sessionDir, 'agents', 'main', 'wire.jsonl')
}

function readIndex(): Map<string, KimiIndexRecord> {
  const bySessionDir = new Map<string, KimiIndexRecord>()
  if (!fs.existsSync(KIMI_INDEX_FILE)) return bySessionDir

  try {
    const lines = fs.readFileSync(KIMI_INDEX_FILE, 'utf-8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const record = JSON.parse(trimmed) as KimiIndexRecord
        if (record.sessionDir) bySessionDir.set(record.sessionDir, record)
      } catch {
        // skip malformed index rows
      }
    }
  } catch {
    // ignore missing or unreadable index
  }

  return bySessionDir
}

export function listKimiSessions(): KimiSessionFiles[] {
  const files: KimiSessionFiles[] = []
  if (!fs.existsSync(KIMI_SESSIONS_DIR)) return files

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      let stat: fs.Stats
      try {
        stat = fs.statSync(full)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(full)
        continue
      }

      if (entry !== 'state.json') continue
      const sessionDir = path.dirname(full)
      const wirePath = getMainWirePath(sessionDir)
      if (fs.existsSync(wirePath)) {
        files.push({ sessionDir, statePath: full, wirePath })
      }
    }
  }

  walk(KIMI_SESSIONS_DIR)
  return files
}

async function readKimiStats(wirePath: string): Promise<{ turnCount: number; eventCount: number; toolCallCount: number }> {
  let count = 0
  let eventCount = 0
  let toolCallCount = 0
  const rl = createInterface({ input: fs.createReadStream(wirePath), crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const record = JSON.parse(trimmed) as KimiRecord
      if (record.type === 'turn.prompt' && extractText(record.input).trim()) {
        count++
      }
      if (record.type === 'context.append_loop_event' && record.event) {
        eventCount++
        if (record.event.type === 'tool.call') toolCallCount++
      }
    } catch {
      // skip malformed rows
    }
  }
  rl.close()
  return { turnCount: count, eventCount, toolCallCount }
}

export async function readKimiMeta(files: KimiSessionFiles): Promise<SessionMeta | null> {
  const state = readState(files.statePath)
  if (!state?.createdAt) return null

  const index = readIndex().get(files.sessionDir)
  const id = index?.sessionId || getSessionId(files.sessionDir)
  const { turnCount, eventCount, toolCallCount } = await readKimiStats(files.wirePath)
  if (turnCount === 0) return null
  const title = makeSessionTitle(state.title || state.lastPrompt)

  return {
    id,
    source: 'kimi',
    startedAt: state.createdAt,
    cwd: index?.workDir || '',
    projectPath: path.basename(path.dirname(files.sessionDir)),
    title,
    summary: title,
    eventCount: eventCount || undefined,
    toolCallCount: toolCallCount || undefined,
    model: await readKimiModel(files.wirePath),
    turnCount,
    filePath: files.statePath,
  }
}

async function readKimiModel(wirePath: string): Promise<string | undefined> {
  const rl = createInterface({ input: fs.createReadStream(wirePath), crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const record = JSON.parse(trimmed) as KimiRecord
      if (record.type === 'config.update' && record.modelAlias) {
        rl.close()
        return record.modelAlias
      }
      if (record.type === 'usage.record' && record.model) {
        rl.close()
        return record.model
      }
    } catch {
      // skip
    }
  }
  rl.close()
  return undefined
}

export async function parseKimiSession(statePath: string): Promise<TraceSession | null> {
  const sessionDir = path.dirname(statePath)
  const wirePath = getMainWirePath(sessionDir)
  const state = readState(statePath)
  if (!state?.createdAt || !fs.existsSync(wirePath)) return null

  const index = readIndex().get(sessionDir)
  const id = index?.sessionId || getSessionId(sessionDir)
  const model = await readKimiModel(wirePath)
  const turns = await parseKimiTurns(wirePath)
  if (turns.length === 0) return null
  const stats = await readKimiStats(wirePath)
  const title = makeSessionTitle(state.title || turns[0]?.userMessage || state.lastPrompt)

  return {
    id,
    source: 'kimi',
    startedAt: state.createdAt,
    cwd: index?.workDir || '',
    projectPath: path.basename(path.dirname(sessionDir)),
    title,
    summary: title,
    eventCount: stats.eventCount || undefined,
    toolCallCount: stats.toolCallCount || undefined,
    model,
    turns,
    filePath: statePath,
  }
}

async function parseKimiTurns(wirePath: string): Promise<TraceTurn[]> {
  const turns: TraceTurn[] = []
  let current: TraceTurn | null = null
  let currentTurnId = ''
  const textByTurn = new Map<string, string[]>()

  function finishCurrent() {
    if (!current) return

    const assistantText = (textByTurn.get(current.id) || []).join('').trim()
    if (assistantText) current.assistantMessage = assistantText
    turns.push(current)
    current = null
    currentTurnId = ''
  }

  const rl = createInterface({ input: fs.createReadStream(wirePath), crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let record: KimiRecord
    try {
      record = JSON.parse(trimmed) as KimiRecord
    } catch {
      continue
    }

    if (record.type === 'turn.prompt') {
      finishCurrent()
      const userMessage = extractText(record.input).trim()
      if (!userMessage) continue

      currentTurnId = String(turns.length)
      current = {
        id: currentTurnId,
        userMessage,
        steps: [],
      }
      textByTurn.set(current.id, [])
      continue
    }

    if (!current) continue

    if (record.type === 'usage.record' && record.usage) {
      current.tokenUsage = mergeUsage(current.tokenUsage, record.usage)
      continue
    }

    if (record.type !== 'context.append_loop_event' || !record.event) continue
    const event = record.event
    const eventTurnId = event.turnId == null ? currentTurnId : String(event.turnId)
    if (eventTurnId !== currentTurnId) continue

    if (event.type === 'content.part') {
      const part = event.part
      if (!isRecord(part)) continue

      if (part.type === 'think') {
        const text = extractText(part).trim()
        if (!text) continue
        current.steps.push({
          id: event.uuid || `thinking-${current.steps.length}`,
          type: 'thinking',
          text,
        })
        continue
      }

      if (part.type === 'text') {
        const text = extractText(part)
        if (text) textByTurn.get(current.id)?.push(text)
      }
      continue
    }

    if (event.type === 'tool.call') {
      const callId = event.toolCallId || event.uuid || `call-${current.steps.length}`
      current.steps.push({
        id: `tool-${callId}`,
        type: 'tool_use',
        callId,
        name: event.name,
        input: toInputRecord(event.args),
      })
      continue
    }

    if (event.type === 'tool.result') {
      const callId = event.toolCallId || event.parentUuid || `call-${current.steps.length}`
      const result = event.result
      const output = isRecord(result) && typeof result.output === 'string'
        ? result.output
        : stringifyUnknown(result)

      current.steps.push({
        id: `result-${callId}`,
        type: 'tool_result',
        callId,
        output,
        isError: isRecord(result) && result.isError === true,
      })
      continue
    }

    if (event.type === 'step.end') {
      current.tokenUsage = mergeUsage(current.tokenUsage, event.usage)
    }
  }
  rl.close()
  finishCurrent()

  return turns
}
