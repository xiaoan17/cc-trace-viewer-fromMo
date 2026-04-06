import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readClaudeMeta, parseClaudeSession } from '../claude.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function writeTmp(lines: object[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-test-'))
  const file = path.join(dir, 'session.jsonl')
  fs.writeFileSync(file, lines.map(l => JSON.stringify(l)).join('\n') + '\n')
  return file
}

let tmpFiles: string[] = []
afterEach(() => {
  for (const f of tmpFiles) {
    try { fs.rmSync(path.dirname(f), { recursive: true }) } catch { /* ok */ }
  }
  tmpFiles = []
})
function tmp(lines: object[]) { const f = writeTmp(lines); tmpFiles.push(f); return f }

// ── fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'test-session-uuid'
const CWD = '/home/user/project'
const TS = '2024-01-01T00:00:00.000Z'

function baseRecord(extra: object = {}) {
  return { sessionId: SESSION_ID, cwd: CWD, timestamp: TS, uuid: 'root', parentUuid: null, ...extra }
}

function userMsg(uuid: string, parentUuid: string | null, content: unknown) {
  return { type: 'user', uuid, parentUuid, message: { role: 'user', content } }
}

function assistantMsg(uuid: string, parentUuid: string, content: unknown[]) {
  return { type: 'assistant', uuid, parentUuid, message: { role: 'assistant', content } }
}

function toolResultMsg(uuid: string, parentUuid: string, toolUseId: string, output: string) {
  return userMsg(uuid, parentUuid, [{ type: 'tool_result', tool_use_id: toolUseId, content: output }])
}

// ── readClaudeMeta ────────────────────────────────────────────────────────────

describe('readClaudeMeta', () => {
  it('returns correct meta for a valid session', async () => {
    const f = tmp([
      baseRecord(),
      userMsg('u1', 'root', 'Hello'),
      userMsg('u2', 'u1', 'Follow-up'),
    ])
    const meta = await readClaudeMeta(f)
    expect(meta).not.toBeNull()
    expect(meta!.id).toBe(SESSION_ID)
    expect(meta!.cwd).toBe(CWD)
    expect(meta!.startedAt).toBe(TS)
    expect(meta!.source).toBe('claude')
    expect(meta!.turnCount).toBe(2)
  })

  it('returns null when sessionId is missing', async () => {
    const f = tmp([{ type: 'user', uuid: 'u1', message: { role: 'user', content: 'hi' } }])
    expect(await readClaudeMeta(f)).toBeNull()
  })

  it('does not count pure tool_result messages as turns', async () => {
    const f = tmp([
      baseRecord(),
      userMsg('u1', 'root', 'Hello'),
      toolResultMsg('u2', 'u1', 'tool-1', 'result output'),
    ])
    const meta = await readClaudeMeta(f)
    expect(meta!.turnCount).toBe(1)
  })
})

// ── parseClaudeSession ────────────────────────────────────────────────────────

describe('parseClaudeSession', () => {
  it('parses a two-turn session correctly', async () => {
    // Turn 1: user → assistant (text + tool_use) → tool_result → assistant (final)
    // Turn 2: user → assistant (text)
    const f = tmp([
      baseRecord(),
      // Turn 1
      userMsg('u1', 'root', 'What files are here?'),
      assistantMsg('a1', 'u1', [
        { type: 'thinking', thinking: 'Let me check' },
        { type: 'tool_use', id: 'tc1', name: 'Bash', input: { command: 'ls' } },
      ]),
      toolResultMsg('tr1', 'a1', 'tc1', 'file1.ts\nfile2.ts'),
      assistantMsg('a2', 'tr1', [{ type: 'text', text: 'There are two files.' }]),
      // Turn 2
      userMsg('u2', 'a2', 'Thanks'),
      assistantMsg('a3', 'u2', [{ type: 'text', text: 'You are welcome.' }]),
    ])
    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    expect(session!.turns).toHaveLength(2)

    const t1 = session!.turns[0]
    expect(t1.userMessage).toBe('What files are here?')
    expect(t1.steps.some(s => s.type === 'thinking')).toBe(true)
    expect(t1.steps.some(s => s.type === 'tool_use' && s.name === 'Bash')).toBe(true)
    expect(t1.steps.some(s => s.type === 'tool_result')).toBe(true)
    expect(t1.assistantMessage).toBe('There are two files.')

    const t2 = session!.turns[1]
    expect(t2.userMessage).toBe('Thanks')
    expect(t2.assistantMessage).toBe('You are welcome.')
  })

  it('filters out system-injected messages', async () => {
    const f = tmp([
      baseRecord(),
      userMsg('u1', 'root', '<bash-input>ls</bash-input>'),
      userMsg('u2', 'u1', 'Real user message'),
      assistantMsg('a1', 'u2', [{ type: 'text', text: 'Reply' }]),
    ])
    const session = await parseClaudeSession(f)
    expect(session!.turns).toHaveLength(1)
    expect(session!.turns[0].userMessage).toBe('Real user message')
  })

  it('returns null for empty / sessionId-less file', async () => {
    const f = tmp([{ type: 'user', uuid: 'u1', message: { role: 'user', content: 'hi' } }])
    expect(await parseClaudeSession(f)).toBeNull()
  })
})
