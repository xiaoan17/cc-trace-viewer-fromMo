import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseGeminiSession } from '../gemini.js'

const tmpDirs: string[] = []

afterEach(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true })
    } catch {
      // ignore cleanup failures in tests
    }
  }
  tmpDirs.splice(0)
})

function createProjectDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-test-'))
  tmpDirs.push(dir)

  const projectDir = path.join(dir, 'my-project')
  const chatsDir = path.join(projectDir, 'chats')
  fs.mkdirSync(chatsDir, { recursive: true })
  fs.writeFileSync(path.join(projectDir, '.project_root'), '/tmp/my-project-root')

  return { projectDir, chatsDir }
}

function writeLegacySession(data: object): string {
  const { chatsDir } = createProjectDir()
  const file = path.join(chatsDir, 'session-test.json')
  fs.writeFileSync(file, JSON.stringify(data))
  return file
}

function writeJsonlSession(records: object[]): string {
  const { chatsDir } = createProjectDir()
  const file = path.join(chatsDir, 'session-test.jsonl')
  fs.writeFileSync(file, records.map((record) => JSON.stringify(record)).join('\n'))
  return file
}

function writeNestedJsonlSession(records: object[]): string {
  const { chatsDir } = createProjectDir()
  const nestedDir = path.join(chatsDir, 'subagent-session-id')
  fs.mkdirSync(nestedDir, { recursive: true })
  const file = path.join(nestedDir, 'abc123.jsonl')
  fs.writeFileSync(file, records.map((record) => JSON.stringify(record)).join('\n'))
  return file
}

const SESSION_ID = 'gemini-session-id'
const START_TIME = '2024-01-01T10:00:00.000Z'

function baseSession(messages: object[]) {
  return { sessionId: SESSION_ID, startTime: START_TIME, projectHash: 'abc123', messages }
}

describe('parseGeminiSession', () => {
  it('parses a simple legacy user -> gemini turn', () => {
    const file = writeLegacySession(baseSession([
      { id: '1', type: 'user', content: [{ text: 'Hello' }] },
      { id: '2', type: 'gemini', content: 'Hi there!', model: 'gemini-pro', thoughts: [], toolCalls: [], tokens: { input: 10, output: 5, total: 15 } },
    ]))

    const session = parseGeminiSession(file)
    expect(session).not.toBeNull()
    expect(session!.id).toBe(SESSION_ID)
    expect(session!.source).toBe('gemini')
    expect(session!.cwd).toBe('/tmp/my-project-root')
    expect(session!.turns).toHaveLength(1)
    expect(session!.turns[0].userMessage).toBe('Hello')
    expect(session!.turns[0].assistantMessage).toBe('Hi there!')
    expect(session!.turns[0].steps).toHaveLength(0)
    expect(session!.turns[0].tokenUsage).toEqual({ input: 10, output: 5, cached: 0, total: 15 })
  })

  it('extracts tool_use and tool_result from legacy toolCalls', () => {
    const file = writeLegacySession(baseSession([
      { id: '1', type: 'user', content: [{ text: 'Read the file' }] },
      {
        id: '2',
        type: 'gemini',
        content: '',
        model: 'gemini-pro',
        thoughts: [],
        tokens: null,
        toolCalls: [{
          id: 'tc1',
          name: 'read_file',
          args: { file_path: 'README.md' },
          result: [{ functionResponse: { id: 'tc1', name: 'read_file', response: { output: '# Hello' } } }],
        }],
      },
    ]))

    const session = parseGeminiSession(file)!
    const turn = session.turns[0]

    const toolUse = turn.steps.find((step) => step.type === 'tool_use')
    expect(toolUse).toBeDefined()
    expect(toolUse!.name).toBe('read_file')
    expect(toolUse!.input).toEqual({ file_path: 'README.md' })
    expect(toolUse!.callId).toBe('tc1')

    const toolResult = turn.steps.find((step) => step.type === 'tool_result')
    expect(toolResult).toBeDefined()
    expect(toolResult!.output).toBe('# Hello')
    expect(toolResult!.callId).toBe('tc1')
  })

  it('extracts thoughts with subject/description format as thinking steps', () => {
    const file = writeLegacySession(baseSession([
      { id: '1', type: 'user', content: [{ text: 'Think about this' }] },
      {
        id: '2',
        type: 'gemini',
        content: 'Done thinking.',
        model: 'gemini-pro',
        toolCalls: [],
        tokens: null,
        thoughts: [{ subject: 'My plan', description: 'I will do X then Y' }],
      },
    ]))

    const session = parseGeminiSession(file)!
    const thinking = session.turns[0].steps.find((step) => step.type === 'thinking')
    expect(thinking).toBeDefined()
    expect(thinking!.text).toContain('My plan')
    expect(thinking!.text).toContain('I will do X then Y')
    expect(session.turns[0].assistantMessage).toBe('Done thinking.')
  })

  it('preserves info and error events as system steps', () => {
    const file = writeLegacySession(baseSession([
      { id: '1', type: 'user', content: [{ text: 'Hello' }] },
      { id: '2', type: 'error', content: '[API Error: boom]' },
      { id: '3', type: 'info', content: 'This request failed.' },
    ]))

    const session = parseGeminiSession(file)!
    expect(session.turns).toHaveLength(1)
    expect(session.turns[0].assistantMessage).toBeUndefined()
    expect(session.turns[0].steps).toEqual([
      { id: '2', type: 'system', name: 'error', text: '[API Error: boom]', isError: true },
      { id: '3', type: 'system', name: 'info', text: 'This request failed.', isError: false },
    ])
  })

  it('parses jsonl sessions and merges duplicate gemini message ids', () => {
    const file = writeJsonlSession([
      { sessionId: SESSION_ID, startTime: START_TIME, projectHash: 'abc123', kind: 'main' },
      { id: 'user-1', type: 'user', content: [{ text: 'Inspect the repo' }] },
      { $set: { lastUpdated: '2024-01-01T10:00:05.000Z' } },
      { id: 'msg-1', type: 'gemini', content: 'I will inspect the repo.', model: 'gpt-5.4', thoughts: [], tokens: { input: 10, output: 4, cached: 0, total: 14 } },
      {
        id: 'msg-1',
        type: 'gemini',
        content: 'I will inspect the repo.',
        model: 'gpt-5.4',
        thoughts: [],
        tokens: { input: 10, output: 4, cached: 0, total: 14 },
        toolCalls: [{
          id: 'call-1',
          name: 'read_file',
          args: { file_path: 'README.md' },
          result: [{ functionResponse: { response: { output: '# Repo' } } }],
        }],
      },
      { id: 'msg-2', type: 'gemini', content: 'Done.', model: 'gpt-5.4', thoughts: [], tokens: { input: 11, output: 5, cached: 1, total: 16 } },
    ])

    const session = parseGeminiSession(file)!
    expect(session.model).toBe('gpt-5.4')
    expect(session.turns).toHaveLength(1)
    expect(session.turns[0].assistantMessage).toBe('Done.')
    expect(session.turns[0].tokenUsage).toEqual({ input: 11, output: 5, cached: 1, total: 16 })
    expect(session.turns[0].steps.map((step) => step.type)).toEqual(['text', 'tool_use', 'tool_result'])
    expect(session.turns[0].steps[0].text).toBe('I will inspect the repo.')
    expect(session.turns[0].steps[1].callId).toBe('call-1')
    expect(session.turns[0].steps[2].output).toBe('# Repo')
  })

  it('keeps final assistant text even when an info event follows it', () => {
    const file = writeJsonlSession([
      { sessionId: SESSION_ID, startTime: START_TIME, projectHash: 'abc123', kind: 'main' },
      { id: 'user-1', type: 'user', content: [{ text: 'Run it' }] },
      {
        id: 'tool-msg',
        type: 'gemini',
        content: '',
        model: 'deepseek-chat',
        thoughts: [],
        tokens: { input: 10, output: 4, total: 14 },
        toolCalls: [{
          id: 'call-1',
          name: 'run_shell_command',
          args: { command: 'python confirm.py' },
          result: [],
          resultDisplay: [[{ text: 'command output' }]],
        }],
      },
      { id: 'final-msg', type: 'gemini', content: 'Done.', model: 'deepseek-chat', thoughts: [], tokens: { input: 11, output: 5, total: 16 } },
      { id: 'info-1', type: 'info', content: 'A new version is available.' },
    ])

    const session = parseGeminiSession(file)!
    expect(session.turns[0].assistantMessage).toBe('Done.')
    expect(session.turns[0].steps.map((step) => step.type)).toEqual(['tool_use', 'tool_result', 'system'])
    expect(session.turns[0].steps[1].output).toBe('command output')
  })

  it('parses nested jsonl chat files under chats/<session> and uses the project root', () => {
    const file = writeNestedJsonlSession([
      {
        sessionId: 'nested-session',
        startTime: START_TIME,
        projectHash: 'abc123',
        kind: 'subagent',
        directories: ['/tmp/explicit-root'],
      },
      { id: 'user-1', type: 'user', content: [{ text: 'Summarize' }] },
      { id: 'msg-1', type: 'gemini', content: 'Summary.', model: 'gemini-3-flash-preview', thoughts: [], tokens: null },
    ])

    const session = parseGeminiSession(file)!
    expect(session.id).toBe('nested-session')
    expect(session.cwd).toBe('/tmp/explicit-root')
    expect(session.projectPath).toBe('my-project')
    expect(session.turns[0].assistantMessage).toBe('Summary.')
  })

  it('returns null when messages array is empty', () => {
    const file = writeLegacySession(baseSession([]))
    expect(parseGeminiSession(file)).toBeNull()
  })

  it('parses info/error-only sessions as session event turns', () => {
    const file = writeLegacySession(baseSession([
      { id: '1', type: 'info', content: 'Waiting for authentication...' },
      { id: '2', type: 'error', content: 'Automatic update failed.' },
    ]))

    const session = parseGeminiSession(file)!
    expect(session.turns).toHaveLength(1)
    expect(session.turns[0].userMessage).toBe('Session events')
    expect(session.turns[0].steps).toEqual([
      { id: '1', type: 'system', name: 'info', text: 'Waiting for authentication...', isError: false },
      { id: '2', type: 'system', name: 'error', text: 'Automatic update failed.', isError: true },
    ])
  })

  it('returns null for invalid JSON file', () => {
    const { chatsDir } = createProjectDir()
    const file = path.join(chatsDir, 'bad.json')
    fs.writeFileSync(file, 'not json')
    expect(parseGeminiSession(file)).toBeNull()
  })
})
