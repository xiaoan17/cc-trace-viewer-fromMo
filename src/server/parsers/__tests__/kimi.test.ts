import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readKimiMeta, parseKimiSession } from '../kimi.js'

const tmpDirs: string[] = []

afterEach(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true })
    } catch {
      // ignore cleanup failures
    }
  }
  tmpDirs.splice(0)
})

function writeKimiSession(records: object[], state: object = {}, agentRecords: Record<string, object[]> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-test-'))
  tmpDirs.push(root)

  const sessionDir = path.join(root, 'sessions', 'wd_project_hash', 'session_test-id')
  const agentDir = path.join(sessionDir, 'agents', 'main')
  fs.mkdirSync(agentDir, { recursive: true })

  const statePath = path.join(sessionDir, 'state.json')
  const wirePath = path.join(agentDir, 'wire.jsonl')
  fs.writeFileSync(statePath, JSON.stringify({
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T10:05:00.000Z',
    title: 'Test session',
    ...state,
  }))
  fs.writeFileSync(wirePath, records.map((record) => JSON.stringify(record)).join('\n') + '\n')

  for (const [agentName, records] of Object.entries(agentRecords)) {
    const subAgentDir = path.join(sessionDir, 'agents', agentName)
    fs.mkdirSync(subAgentDir, { recursive: true })
    fs.writeFileSync(
      path.join(subAgentDir, 'wire.jsonl'),
      records.map((record) => JSON.stringify(record)).join('\n') + '\n',
    )
  }

  return {
    sessionDir,
    statePath,
    wirePath,
    agentWirePaths: Object.keys(agentRecords).map((agentName) => path.join(sessionDir, 'agents', agentName, 'wire.jsonl')),
  }
}

function prompt(text: string, time = 1704103200000) {
  return { type: 'turn.prompt', input: [{ type: 'text', text }], origin: { kind: 'user' }, time }
}

function config(modelAlias = 'moonshot/kimi-k2') {
  return { type: 'config.update', modelAlias, time: 1704103200000 }
}

function event(event: object, time = 1704103200000) {
  return { type: 'context.append_loop_event', event, time }
}

describe('readKimiMeta', () => {
  it('returns session metadata from state and wire files', async () => {
    const files = writeKimiSession([
      config(),
      prompt('Explain this repo'),
      event({ type: 'content.part', uuid: 'text-1', turnId: '0', step: 1, part: { type: 'text', text: 'Done.' } }),
    ])

    const meta = await readKimiMeta(files)
    expect(meta).not.toBeNull()
    expect(meta!.id).toBe('session_test-id')
    expect(meta!.source).toBe('kimi')
    expect(meta!.startedAt).toBe('2024-01-01T10:00:00.000Z')
    expect(meta!.turnCount).toBe(1)
    expect(meta!.title).toBe('Test session')
    expect(meta!.eventCount).toBe(1)
    expect(meta!.model).toBe('moonshot/kimi-k2')
    expect(meta!.filePath).toBe(files.statePath)
  })

  it('returns null for sessions without user turns', async () => {
    const files = writeKimiSession([config()])
    expect(await readKimiMeta(files)).toBeNull()
  })
})

describe('parseKimiSession', () => {
  it('parses assistant text, thinking, tools, and token usage', async () => {
    const { statePath } = writeKimiSession([
      config(),
      prompt('Read package.json'),
      event({ type: 'step.begin', uuid: 'step-1', turnId: '0', step: 1 }),
      event({ type: 'content.part', uuid: 'think-1', turnId: '0', step: 1, part: { type: 'think', think: 'Need to inspect the file.' } }),
      event({ type: 'tool.call', uuid: 'call-1', turnId: '0', toolCallId: 'call-1', name: 'Read', args: { file_path: 'package.json' } }),
      event({ type: 'tool.result', parentUuid: 'call-1', toolCallId: 'call-1', result: { output: '{"name":"app"}' } }),
      event({ type: 'content.part', uuid: 'text-1', turnId: '0', step: 1, part: { type: 'text', text: 'The package is ' } }),
      event({ type: 'content.part', uuid: 'text-2', turnId: '0', step: 1, part: { type: 'text', text: 'app.' } }),
      event({ type: 'step.end', uuid: 'step-1', turnId: '0', step: 1, usage: { inputOther: 10, inputCacheRead: 2, inputCacheCreation: 3, output: 5 } }),
    ])

    const session = await parseKimiSession(statePath)
    expect(session).not.toBeNull()
    expect(session!.source).toBe('kimi')
    expect(session!.title).toBe('Test session')
    expect(session!.eventCount).toBe(7)
    expect(session!.toolCallCount).toBe(1)
    expect(session!.turns).toHaveLength(1)

    const turn = session!.turns[0]
    expect(turn.userMessage).toBe('Read package.json')
    expect(turn.assistantMessage).toBe('The package is app.')
    expect(turn.tokenUsage).toEqual({ input: 15, output: 5, cached: 2, total: 20 })
    expect(turn.steps.map((step) => step.type)).toEqual(['thinking', 'tool_use', 'tool_result'])
    expect(turn.steps[0].text).toBe('Need to inspect the file.')
    expect(turn.steps[1].name).toBe('Read')
    expect(turn.steps[1].input).toEqual({ file_path: 'package.json' })
    expect(turn.steps[2].output).toBe('{"name":"app"}')
  })

  it('splits multiple prompts into multiple turns', async () => {
    const { statePath } = writeKimiSession([
      prompt('First question'),
      event({ type: 'content.part', uuid: 'text-1', turnId: '0', step: 1, part: { type: 'text', text: 'First answer' } }),
      prompt('Second question'),
      event({ type: 'content.part', uuid: 'text-2', turnId: '1', step: 1, part: { type: 'text', text: 'Second answer' } }),
    ])

    const session = await parseKimiSession(statePath)
    expect(session!.turns).toHaveLength(2)
    expect(session!.turns[0].userMessage).toBe('First question')
    expect(session!.turns[0].assistantMessage).toBe('First answer')
    expect(session!.turns[1].userMessage).toBe('Second question')
    expect(session!.turns[1].assistantMessage).toBe('Second answer')
  })

  it('keeps current Kimi steering and subagent trace metadata visible', async () => {
    const files = writeKimiSession([
      config(),
      prompt('Investigate the repo'),
      { type: 'turn.steer', input: [{ type: 'text', text: 'Keep going' }], origin: { kind: 'user' }, time: 1704103200000 },
      { type: 'tools.update_store', key: 'todos', value: { open: 1 }, time: 1704103200000 },
      event({ type: 'content.part', uuid: 'text-1', turnId: '0', step: 1, part: { type: 'text', text: 'Done.' } }),
    ], {}, {
      'agent-0': [
        config('moonshot/kimi-k2-agent'),
        prompt('Subagent prompt'),
        event({ type: 'tool.call', uuid: 'call-1', turnId: '0', toolCallId: 'call-1', name: 'Read', args: { file_path: 'a.ts' } }),
        event({ type: 'tool.result', parentUuid: 'call-1', toolCallId: 'call-1', result: { output: 'ok' } }),
      ],
    })

    const meta = await readKimiMeta({
      sessionDir: files.sessionDir,
      statePath: files.statePath,
      wirePath: files.wirePath,
      agentWirePaths: files.agentWirePaths,
    })
    expect(meta!.turnCount).toBe(1)
    expect(meta!.eventCount).toBe(3)
    expect(meta!.toolCallCount).toBe(1)

    const session = await parseKimiSession(files.statePath)
    expect(session).not.toBeNull()
    const steps = session!.turns[0].steps
    expect(steps.some((step) => step.type === 'system' && step.name === 'turn_steer' && step.text === 'Keep going')).toBe(true)
    expect(steps.some((step) => step.type === 'system' && step.name === 'tools_update_store:todos' && step.text?.includes('"open": 1'))).toBe(true)
    expect(steps.some((step) => step.type === 'system' && step.name === 'subagent_trace' && step.text?.includes('Subagent prompt'))).toBe(true)
  })
})
