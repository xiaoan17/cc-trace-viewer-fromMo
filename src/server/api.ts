import { Router } from 'express'
import { listClaudeSessions, readClaudeMeta, parseClaudeSession } from './parsers/claude.js'
import { listCodexSessions, readCodexMeta, parseCodexSession } from './parsers/codex.js'
import { listGeminiSessions, parseGeminiSession } from './parsers/gemini.js'
import type { SessionMeta } from '../shared/types.js'

export const router = Router()

// Cache for session list — longer TTL since meta-only scan is fast
let sessionCache: SessionMeta[] | null = null
let cacheTime = 0
const CACHE_TTL = 30_000 // 30s

router.get('/sessions', async (_req, res) => {
  const now = Date.now()
  if (sessionCache && now - cacheTime < CACHE_TTL) {
    res.json(sessionCache)
    return
  }

  const metas: SessionMeta[] = []

  // Claude — fast meta scan (no full turn parsing)
  const claudeFiles = await listClaudeSessions()
  for (const filePath of claudeFiles) {
    try {
      const m = await readClaudeMeta(filePath)
      if (m && m.turnCount > 0) metas.push(m)
    } catch { /* skip */ }
  }

  // Codex — fast meta scan
  const codexFiles = listCodexSessions()
  for (const filePath of codexFiles) {
    try {
      const m = await readCodexMeta(filePath)
      if (m) metas.push(m)
    } catch { /* skip */ }
  }

  // Gemini — files are small JSON, full parse is fine
  const geminiFiles = listGeminiSessions()
  for (const filePath of geminiFiles) {
    try {
      const session = parseGeminiSession(filePath)
      if (!session) continue
      metas.push({
        id: session.id,
        source: 'gemini',
        startedAt: session.startedAt,
        cwd: session.cwd,
        projectPath: session.projectPath,
        model: session.model,
        turnCount: session.turns.length,
        filePath: session.filePath,
      })
    } catch { /* skip */ }
  }

  metas.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  sessionCache = metas
  cacheTime = now
  res.json(metas)
})

router.get('/sessions/:id', async (req, res) => {
  const source = req.query.source as string
  const filePath = req.query.filePath as string

  if (!filePath) {
    res.status(400).json({ error: 'filePath query param required' })
    return
  }

  try {
    let session = null
    if (source === 'claude') {
      session = await parseClaudeSession(filePath)
    } else if (source === 'codex') {
      session = await parseCodexSession(filePath)
    } else if (source === 'gemini') {
      session = parseGeminiSession(filePath)
    }

    if (!session) {
      res.status(404).json({ error: 'Session not found or empty' })
      return
    }
    res.json(session)
  } catch (err) {
    console.error('Session parse error:', err)
    res.status(500).json({ error: String(err) })
  }
})
