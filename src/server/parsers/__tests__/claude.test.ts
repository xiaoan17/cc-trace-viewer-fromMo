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

function systemMsg(uuid: string, parentUuid: string, subtype: string, extra: object = {}) {
  return { type: 'system', uuid, parentUuid, subtype, ...extra }
}

function queueOperationMsg(uuid: string, parentUuid: string, content: string, operation = 'enqueue') {
  return { type: 'queue-operation', uuid, parentUuid, operation, content }
}

function attachmentMsg(uuid: string, parentUuid: string, attachment: object) {
  return { type: 'attachment', uuid, parentUuid, attachment, sessionId: SESSION_ID, timestamp: TS }
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
    expect(meta!.title).toBe('Hello')
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

  it('counts user turns after long tool-heavy prefixes', async () => {
    const filler = Array.from({ length: 520 }, (_, i) =>
      toolResultMsg(`tr-${i}`, 'root', `tool-${i}`, `output ${i}`),
    )
    const f = tmp([
      baseRecord(),
      ...filler,
      userMsg('u1', 'root', 'Late user message'),
    ])

    const meta = await readClaudeMeta(f)
    expect(meta!.turnCount).toBe(1)
  })

  it('uses agentId to distinguish sidechain subagent sessions', async () => {
    const f = tmp([
      { ...baseRecord(), isSidechain: true, agentId: 'agent-abc' },
      userMsg('u1', 'root', 'Subagent prompt'),
    ])

    const meta = await readClaudeMeta(f)
    expect(meta!.id).toBe(`${SESSION_ID}:agent-abc`)
  })

  it('fills metadata from later records when the first session record is permission-only', async () => {
    const f = tmp([
      { type: 'permission-mode', permissionMode: 'default', sessionId: SESSION_ID },
      baseRecord({ type: 'user', uuid: 'u1', parentUuid: 'root', message: { role: 'user', content: 'Hello' } }),
    ])

    const meta = await readClaudeMeta(f)
    expect(meta).not.toBeNull()
    expect(meta!.startedAt).toBe(TS)
    expect(meta!.cwd).toBe(CWD)
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
    const toolUse = t1.steps.find(s => s.type === 'tool_use')
    const toolResult = t1.steps.find(s => s.type === 'tool_result')
    expect(toolUse!.callId).toBe('tc1')
    expect(toolResult!.callId).toBe('tc1')

    const t2 = session!.turns[1]
    expect(t2.userMessage).toBe('Thanks')
    expect(t2.assistantMessage).toBe('You are welcome.')
    expect(session!.title).toBe('What files are here?')
    expect(session!.eventCount).toBe(3)
    expect(session!.toolCallCount).toBe(1)
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

  it('strips IDE context tags without dropping the real user prompt', async () => {
    const f = tmp([
      baseRecord(),
      userMsg('u1', 'root', [
        { type: 'text', text: '<ide_opened_file>The user opened a file.</ide_opened_file>' },
        { type: 'text', text: '这个项目是不是有个 vscode 插件' },
      ]),
      assistantMsg('a1', 'u1', [{ type: 'text', text: '有。' }]),
    ])

    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    expect(session!.turns[0].userMessage).toBe('这个项目是不是有个 vscode 插件')
  })

  it('keeps image-only user prompts as turns', async () => {
    const f = tmp([
      baseRecord(),
      userMsg('u1', 'root', [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } }]),
      assistantMsg('a1', 'u1', [{ type: 'text', text: 'I can see the image.' }]),
    ])

    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    expect(session!.turns[0].userMessage).toBe('[image]')
    expect(session!.turns[0].assistantMessage).toBe('I can see the image.')
  })

  it('uses agentId to distinguish parsed sidechain subagent sessions', async () => {
    const f = tmp([
      { ...baseRecord(), isSidechain: true, agentId: 'agent-abc', type: 'user', message: { role: 'user', content: 'Subagent prompt' } },
      assistantMsg('a1', 'root', [{ type: 'text', text: 'Subagent response' }]),
    ])

    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    expect(session!.id).toBe(`${SESSION_ID}:agent-abc`)
  })

  it('fills parsed session metadata from later timestamped records', async () => {
    const f = tmp([
      { type: 'permission-mode', permissionMode: 'default', sessionId: SESSION_ID },
      baseRecord({ type: 'user', uuid: 'u1', parentUuid: 'root', message: { role: 'user', content: 'Hello' } }),
      assistantMsg('a1', 'u1', [{ type: 'text', text: 'Hi' }]),
    ])

    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    expect(session!.startedAt).toBe(TS)
    expect(session!.cwd).toBe(CWD)
  })

  it('collects sibling tool branches in a single Claude turn', async () => {
    const f = tmp([
      baseRecord(),
      userMsg('u1', 'root', 'Inspect project'),
      assistantMsg('a1', 'u1', [{ type: 'text', text: 'Checking files.' }]),
      assistantMsg('a2', 'a1', [{ type: 'tool_use', id: 'tc1', name: 'Read', input: { file_path: 'a.ts' } }]),
      assistantMsg('a3', 'a2', [{ type: 'tool_use', id: 'tc2', name: 'Read', input: { file_path: 'b.ts' } }]),
      toolResultMsg('tr1', 'a2', 'tc1', 'alpha'),
      toolResultMsg('tr2', 'a3', 'tc2', 'beta'),
      assistantMsg('a4', 'tr2', [{ type: 'text', text: 'Done.' }]),
    ])

    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    expect(session!.turns).toHaveLength(1)
    expect(session!.turns[0].steps.filter((step) => step.type === 'tool_use')).toHaveLength(2)
    expect(session!.turns[0].steps.filter((step) => step.type === 'tool_result')).toHaveLength(2)
    expect(session!.turns[0].steps.some((step) => step.type === 'tool_result' && step.output === 'alpha')).toBe(true)
    expect(session!.turns[0].steps.some((step) => step.type === 'tool_result' && step.output === 'beta')).toBe(true)
  })

  it('keeps Claude system events as steps', async () => {
    const f = tmp([
      baseRecord(),
      userMsg('u1', 'root', 'Hello'),
      assistantMsg('a1', 'u1', [{ type: 'text', text: 'Hi' }]),
      systemMsg('s1', 'a1', 'turn_duration', { durationMs: 1234, messageCount: 4 }),
    ])

    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    expect(session!.turns[0].steps.some((step) => step.type === 'system' && step.name === 'turn_duration')).toBe(true)
  })

  it('groups local command output into the triggering command turn', async () => {
    const f = tmp([
      baseRecord(),
      userMsg('meta1', 'root', '<local-command-caveat>Caveat</local-command-caveat>'),
      userMsg('cmd1', 'meta1', '<command-name>/plugin</command-name><command-args>install codex</command-args>'),
      userMsg('out1', 'cmd1', '<local-command-stdout>Installed codex</local-command-stdout>'),
      userMsg('meta2', 'out1', '<local-command-caveat>Caveat</local-command-caveat>'),
      userMsg('err1', 'meta2', 'Unknown skill: codex:setup'),
    ])

    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    expect(session!.turns).toHaveLength(1)
    expect(session!.turns[0].userMessage).toBe('/plugin install codex')
    expect(session!.turns[0].steps.some((step) => step.type === 'system' && step.text === 'Installed codex')).toBe(true)
    expect(session!.turns[0].steps.some((step) => step.type === 'system' && step.text === 'Unknown skill: codex:setup')).toBe(true)
  })

  it('keeps task notifications inside the current turn as readable task events', async () => {
    const taskNotification = [
      '<task-notification>',
      '<task-id>bsz67v9fe</task-id>',
      '<tool-use-id>call_95a71e7ed5dc4391a0fb3734</tool-use-id>',
      '<output-file>/tmp/tasks/bsz67v9fe.output</output-file>',
      '<status>failed</status>',
      '<summary>Background command "Monitor progress every 30s for 5 minutes" failed with exit code 144</summary>',
      '</task-notification>',
    ].join('')
    const f = tmp([
      baseRecord(),
      userMsg('u1', 'root', 'Run the monitor'),
      assistantMsg('a1', 'u1', [{ type: 'tool_use', id: 'call_95a71e7ed5dc4391a0fb3734', name: 'Task', input: { description: 'Monitor progress every 30s for 5 minutes' } }]),
      userMsg('task1', 'a1', taskNotification),
      queueOperationMsg('q1', 'task1', taskNotification),
      assistantMsg('a2', 'q1', [{ type: 'text', text: 'The background task failed.' }]),
    ])

    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    expect(session!.turns).toHaveLength(1)
    expect(session!.turns[0].userMessage).toBe('Run the monitor')
    expect(session!.turns[0].steps.some((step) => step.type === 'system' && step.name === 'task_failed' && step.callId === 'call_95a71e7ed5dc4391a0fb3734')).toBe(true)
    expect(session!.turns[0].steps.some((step) => step.text?.includes('Background command "Monitor progress every 30s for 5 minutes" failed with exit code 144'))).toBe(true)
    expect(session!.turns[0].assistantMessage).toBe('The background task failed.')
  })

  it('keeps current Claude attachment, file history, and away summary records visible', async () => {
    const f = tmp([
      baseRecord(),
      userMsg('u1', 'root', 'Review current context'),
      attachmentMsg('att1', 'u1', { type: 'selected_files', addedLines: 2 }),
      { type: 'file-history-snapshot', uuid: 'fh1', parentUuid: 'att1', sessionId: SESSION_ID, timestamp: TS, isSnapshotUpdate: true },
      systemMsg('away1', 'fh1', 'away_summary', { content: 'User was away while work continued.' }),
      assistantMsg('a1', 'away1', [{ type: 'text', text: 'Context reviewed.' }]),
    ])

    const meta = await readClaudeMeta(f)
    expect(meta!.eventCount).toBe(4)

    const session = await parseClaudeSession(f)
    expect(session).not.toBeNull()
    const steps = session!.turns[0].steps
    expect(steps.some((step) => step.type === 'system' && step.name === 'attachment' && step.text?.includes('selected_files'))).toBe(true)
    expect(steps.some((step) => step.type === 'system' && step.name === 'file-history-snapshot')).toBe(true)
    expect(steps.some((step) => step.type === 'system' && step.name === 'away_summary' && step.text?.includes('User was away'))).toBe(true)
  })

  it('returns null for empty / sessionId-less file', async () => {
    const f = tmp([{ type: 'user', uuid: 'u1', message: { role: 'user', content: 'hi' } }])
    expect(await parseClaudeSession(f)).toBeNull()
  })
})
