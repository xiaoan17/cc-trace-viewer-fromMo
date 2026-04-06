import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readCodexMeta, parseCodexSession } from '../codex.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function writeTmp(lines: object[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-test-'))
  const file = path.join(dir, 'session.jsonl')
  fs.writeFileSync(file, lines.map(l => JSON.stringify(l)).join('\n') + '\n')
  return file
}

const tmpDirs: string[] = []
afterEach(() => {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true }) } catch { /* ok */ }
  }
  tmpDirs.splice(0)
})
function tmp(lines: object[]) {
  const f = writeTmp(lines)
  tmpDirs.push(path.dirname(f))
  return f
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'codex-session-id'
const CWD = '/home/user/project'
const TS_START = '2024-01-01T10:00:00.000Z'
const TS_END = '2024-01-01T10:05:00.000Z'

function sessionMeta() {
  return {
    type: 'session_meta',
    payload: { id: SESSION_ID, cwd: CWD, timestamp: TS_START, model_provider: 'openai' },
  }
}

function eventMsg(type: string, extra: object = {}, ts = TS_START) {
  return { type: 'event_msg', timestamp: ts, payload: { type, ...extra } }
}

function responseItem(payload: object, ts = TS_START) {
  return { type: 'response_item', timestamp: ts, payload }
}

// ── readCodexMeta ─────────────────────────────────────────────────────────────

describe('readCodexMeta', () => {
  it('returns correct meta for valid session', async () => {
    const f = tmp([
      sessionMeta(),
      eventMsg('task_started', { turn_id: 't1' }),
      eventMsg('task_started', { turn_id: 't2' }),
    ])
    const meta = await readCodexMeta(f)
    expect(meta).not.toBeNull()
    expect(meta!.id).toBe(SESSION_ID)
    expect(meta!.cwd).toBe(CWD)
    expect(meta!.source).toBe('codex')
    expect(meta!.turnCount).toBe(2)
  })

  it('returns null when session_meta is missing', async () => {
    const f = tmp([eventMsg('task_started', { turn_id: 't1' })])
    expect(await readCodexMeta(f)).toBeNull()
  })
})

// ── parseCodexSession ─────────────────────────────────────────────────────────

describe('parseCodexSession', () => {
  it('parses a single turn with tool calls and reasoning', async () => {
    const f = tmp([
      sessionMeta(),
      eventMsg('task_started', { turn_id: 'turn-1' }, TS_START),
      eventMsg('user_message', { message: 'List all files' }, TS_START),
      eventMsg('agent_reasoning', { text: '**Planning the approach**' }, TS_START),
      responseItem({ type: 'function_call', name: 'exec_command', arguments: '{"cmd":"ls"}', call_id: 'call-1' }, TS_START),
      responseItem({ type: 'reasoning', summary: [{ type: 'summary_text', text: '**Checking output**' }] }, TS_START),
      responseItem({ type: 'function_call_output', call_id: 'call-1', output: 'file1.ts\nfile2.ts' }, TS_START),
      eventMsg('agent_message', { message: 'There are two files.' }, TS_START),
      eventMsg('token_count', { info: { last_token_usage: { input_tokens: 100, output_tokens: 50, cached_input_tokens: 10, total_tokens: 150 } } }, TS_START),
      eventMsg('task_complete', { last_agent_message: 'There are two files.' }, TS_END),
    ])
    const session = await parseCodexSession(f)
    expect(session).not.toBeNull()
    expect(session!.turns).toHaveLength(1)

    const turn = session!.turns[0]
    expect(turn.userMessage).toBe('List all files')
    expect(turn.assistantMessage).toBe('There are two files.')

    const stepTypes = turn.steps.map(s => s.type)
    expect(stepTypes).toContain('tool_use')
    expect(stepTypes).toContain('tool_result')
    expect(stepTypes).toContain('thinking')

    const toolUse = turn.steps.find(s => s.type === 'tool_use')
    expect(toolUse!.name).toBe('exec_command')
    expect(toolUse!.input).toEqual({ cmd: 'ls' })

    const toolResult = turn.steps.find(s => s.type === 'tool_result')
    expect(toolResult!.output).toBe('file1.ts\nfile2.ts')

    expect(turn.tokenUsage).toEqual({ input: 100, output: 50, cached: 10, total: 150 })
  })

  it('returns null when session_meta is missing', async () => {
    const f = tmp([eventMsg('task_started', { turn_id: 't1' })])
    expect(await parseCodexSession(f)).toBeNull()
  })

  it('skips turns with empty user messages', async () => {
    const f = tmp([
      sessionMeta(),
      eventMsg('task_started', { turn_id: 't1' }),
      // no user_message event → empty userMessage
      eventMsg('task_complete', {}),
    ])
    const session = await parseCodexSession(f)
    expect(session).toBeNull()
  })
})
