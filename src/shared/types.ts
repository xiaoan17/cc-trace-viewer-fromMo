export type Source = 'claude' | 'codex' | 'gemini'

export interface TraceSession {
  id: string
  source: Source
  startedAt: string
  cwd: string
  projectPath?: string
  model?: string
  turns: TraceTurn[]
  filePath: string
}

export interface SessionMeta {
  id: string
  source: Source
  startedAt: string
  cwd: string
  projectPath?: string
  model?: string
  turnCount: number
  filePath: string
}

export interface TraceTurn {
  id: string
  userMessage: string
  steps: TraceStep[]
  assistantMessage?: string
  tokenUsage?: TokenUsage
}

export interface TraceStep {
  id: string
  type: 'tool_use' | 'tool_result' | 'thinking' | 'text'
  name?: string
  input?: Record<string, unknown>
  output?: string
  text?: string
  isError?: boolean
}

export interface TokenUsage {
  input: number
  output: number
  cached?: number
  total?: number
}
