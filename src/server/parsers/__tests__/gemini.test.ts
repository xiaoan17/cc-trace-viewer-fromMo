import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseGeminiSession } from '../gemini.js'

// ── helpers ───────────────────────────────────────────────────────────────────

const tmpDirs: string[] = []
afterEach(() => {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true }) } catch { /* ok */ }
  }
  tmpDirs.splice(0)
})

function writeTmp(data: object): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-test-'))
  tmpDirs.push(dir)
  // Mimic the real path pattern: .../tmp/<project>/chats/session-xxx.json
  const chatsDir = path.join(dir, 'my-project', 'chats')
  fs.mkdirSync(chatsDir, { recursive: true })
  const file = path.join(chatsDir, 'session-test.json')
  fs.writeFileSync(file, JSON.stringify(data))
  return file
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'gemini-session-id'
const START_TIME = '2024-01-01T10:00:00.000Z'

function baseSession(messages: object[]) {
  return { sessionId: SESSION_ID, startTime: START_TIME, projectHash: 'abc123', messages }
}

// ── parseGeminiSession ────────────────────────────────────────────────────────

describe('parseGeminiSession', () => {
  it('parses a simple user → gemini turn', () => {
    const f = writeTmp(baseSession([
      { id: '1', type: 'user', content: [{ text: 'Hello' }] },
      { id: '2', type: 'gemini', content: 'Hi there!', model: 'gemini-pro', thoughts: [], toolCalls: [], tokens: { input: 10, output: 5, total: 15 } },
    ]))
    const session = parseGeminiSession(f)
    expect(session).not.toBeNull()
    expect(session!.id).toBe(SESSION_ID)
    expect(session!.source).toBe('gemini')
    expect(session!.turns).toHaveLength(1)
    expect(session!.turns[0].userMessage).toBe('Hello')
    expect(session!.turns[0].assistantMessage).toBe('Hi there!')
    expect(session!.turns[0].tokenUsage).toEqual({ input: 10, output: 5, cached: 0, total: 15 })
  })

  it('extracts tool_use and tool_result from toolCalls', () => {
    const f = writeTmp(baseSession([
      { id: '1', type: 'user', content: [{ text: 'Read the file' }] },
      {
        id: '2', type: 'gemini', content: '', model: 'gemini-pro', thoughts: [], tokens: null,
        toolCalls: [{
          id: 'tc1', name: 'read_file', args: { file_path: 'README.md' },
          result: [{ functionResponse: { id: 'tc1', name: 'read_file', response: { output: '# Hello' } } }],
        }],
      },
    ]))
    const session = parseGeminiSession(f)!
    const turn = session.turns[0]
    const toolUse = turn.steps.find(s => s.type === 'tool_use')
    expect(toolUse).toBeDefined()
    expect(toolUse!.name).toBe('read_file')
    expect(toolUse!.input).toEqual({ file_path: 'README.md' })

    const toolResult = turn.steps.find(s => s.type === 'tool_result')
    expect(toolResult).toBeDefined()
    expect(toolResult!.output).toBe('# Hello')
  })

  it('extracts thoughts with subject/description format as thinking steps', () => {
    const f = writeTmp(baseSession([
      { id: '1', type: 'user', content: [{ text: 'Think about this' }] },
      {
        id: '2', type: 'gemini', content: 'Done thinking.', model: 'gemini-pro', toolCalls: [], tokens: null,
        thoughts: [{ subject: 'My plan', description: 'I will do X then Y' }],
      },
    ]))
    const session = parseGeminiSession(f)!
    const thinking = session.turns[0].steps.find(s => s.type === 'thinking')
    expect(thinking).toBeDefined()
    expect(thinking!.text).toContain('My plan')
    expect(thinking!.text).toContain('I will do X then Y')
  })

  it('ignores info and error messages', () => {
    const f = writeTmp(baseSession([
      { id: '0', type: 'info', content: 'Searching for skills...' },
      { id: '1', type: 'user', content: [{ text: 'Hello' }] },
      { id: '2', type: 'info', content: 'Auth completed' },
      { id: '3', type: 'gemini', content: 'Hi!', model: 'gemini-pro', thoughts: [], toolCalls: [], tokens: null },
    ]))
    const session = parseGeminiSession(f)!
    expect(session.turns).toHaveLength(1)
    expect(session.turns[0].userMessage).toBe('Hello')
  })

  it('returns null when messages array is empty', () => {
    const f = writeTmp(baseSession([]))
    expect(parseGeminiSession(f)).toBeNull()
  })

  it('returns null for invalid JSON file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-bad-'))
    tmpDirs.push(dir)
    const chatsDir = path.join(dir, 'proj', 'chats')
    fs.mkdirSync(chatsDir, { recursive: true })
    const f = path.join(chatsDir, 'bad.json')
    fs.writeFileSync(f, 'not json')
    expect(parseGeminiSession(f)).toBeNull()
  })
})
