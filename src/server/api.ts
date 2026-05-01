import { Router } from 'express'
import fs from 'fs'
import { listClaudeSessions, readClaudeMeta, parseClaudeSession } from './parsers/claude.js'
import { listCodexSessions, readCodexMeta, parseCodexSession } from './parsers/codex.js'
import { listGeminiSessions, parseGeminiSession } from './parsers/gemini.js'
import type { SessionMeta } from '../shared/types.js'

export const router = Router()

// Cache for session list — keyed by time range so "recent" stays fast.
const sessionCache = new Map<string, { data: SessionMeta[]; time: number }>()
const CACHE_TTL = 30_000 // 30s
const DEFAULT_RECENT_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

router.get('/sessions', async (req, res) => {
  const recentDays = parseRecentDays(req.query.recentDays)
  const cutoff = recentDays == null ? null : Date.now() - recentDays * DAY_MS
  const cacheKey = recentDays == null ? 'all' : `recent:${recentDays}`
  const now = Date.now()
  const cached = sessionCache.get(cacheKey)
  if (cached && now - cached.time < CACHE_TTL) {
    res.json(cached.data)
    return
  }

  const metas: SessionMeta[] = []

  // Claude — fast meta scan (no full turn parsing)
  const claudeFiles = await listClaudeSessions()
  for (const filePath of claudeFiles) {
    try {
      if (!fileMayBeRecent(filePath, cutoff)) continue
      const m = await readClaudeMeta(filePath)
      if (m && m.turnCount > 0 && metaIsRecent(m, cutoff)) metas.push(m)
    } catch { /* skip */ }
  }

  // Codex — fast meta scan
  const codexFiles = listCodexSessions()
  for (const filePath of codexFiles) {
    try {
      if (!fileMayBeRecent(filePath, cutoff)) continue
      const m = await readCodexMeta(filePath)
      if (m && metaIsRecent(m, cutoff)) metas.push(m)
    } catch { /* skip */ }
  }

  // Gemini — files are small JSON, full parse is fine
  const geminiFiles = listGeminiSessions()
  for (const filePath of geminiFiles) {
    try {
      if (!fileMayBeRecent(filePath, cutoff)) continue
      const session = parseGeminiSession(filePath)
      if (!session) continue
      if (!metaIsRecent(session, cutoff)) continue
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

  sessionCache.set(cacheKey, { data: metas, time: now })
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

function parseRecentDays(value: unknown): number | null {
  if (Array.isArray(value)) return parseRecentDays(value[0])
  if (value == null || value === '') return DEFAULT_RECENT_DAYS

  const raw = String(value).trim().toLowerCase()
  if (raw === 'all' || raw === '0') return null

  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RECENT_DAYS
  return Math.min(Math.floor(n), 3650)
}

function fileMayBeRecent(filePath: string, cutoff: number | null): boolean {
  if (cutoff == null) return true

  try {
    return fs.statSync(filePath).mtimeMs >= cutoff
  } catch {
    return true
  }
}

function metaIsRecent(meta: Pick<SessionMeta, 'startedAt'>, cutoff: number | null): boolean {
  if (cutoff == null) return true

  const started = new Date(meta.startedAt).getTime()
  if (!Number.isFinite(started)) return true
  return started >= cutoff
}
