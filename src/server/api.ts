import { Router } from 'express'
import fs from 'fs'
import { listClaudeSessions, readClaudeMeta, parseClaudeSession } from './parsers/claude.js'
import { listCodexSessions, readCodexMeta, parseCodexSession } from './parsers/codex.js'
import { listKimiSessions, readKimiMeta, parseKimiSession } from './parsers/kimi.js'
import { parseGeminiSession } from './parsers/gemini.js'
import type { SessionAgeRange, SessionMeta } from '../shared/types.js'

export const router = Router()

// Cache for session list — longer TTL since meta-only scan is fast
const sessionCache = new Map<SessionAgeRange, { metas: SessionMeta[]; cacheTime: number }>()
const CACHE_TTL = 30_000 // 30s
const DAY_MS = 24 * 60 * 60 * 1000

function parseAgeRange(value: unknown): SessionAgeRange {
  return value === '7d' || value === '30d' || value === 'older' ? value : '1d'
}

function ageLimitMs(age: Exclude<SessionAgeRange, 'older'>): number {
  return age === '1d' ? DAY_MS : age === '7d' ? 7 * DAY_MS : 30 * DAY_MS
}

function fileMayMatchAgeRange(filePath: string, age: SessionAgeRange, now: number): boolean {
  if (age === 'older') return true

  try {
    return now - fs.statSync(filePath).mtimeMs <= ageLimitMs(age)
  } catch {
    return true
  }
}

function metaMatchesAgeRange(meta: SessionMeta, age: SessionAgeRange, now: number): boolean {
  const startedAtMs = new Date(meta.startedAt).getTime()
  if (!Number.isFinite(startedAtMs)) return false

  const elapsed = now - startedAtMs
  if (elapsed < 0) return true
  if (age === 'older') return elapsed > 30 * DAY_MS
  return elapsed <= ageLimitMs(age)
}

async function pushMetaIfMatching(
  metas: SessionMeta[],
  filePath: string,
  age: SessionAgeRange,
  now: number,
  readMeta: (filePath: string) => Promise<SessionMeta | null>,
) {
  if (!fileMayMatchAgeRange(filePath, age, now)) return

  const meta = await readMeta(filePath)
  if (meta && metaMatchesAgeRange(meta, age, now)) {
    metas.push(meta)
  }
}

router.get('/sessions', async (req, res) => {
  const age = parseAgeRange(req.query.age)
  const now = Date.now()
  const cached = sessionCache.get(age)
  if (cached && now - cached.cacheTime < CACHE_TTL) {
    res.json(cached.metas)
    return
  }

  const metas: SessionMeta[] = []

  // Claude — fast meta scan (no full turn parsing)
  const claudeFiles = await listClaudeSessions()
  for (const filePath of claudeFiles) {
    try {
      await pushMetaIfMatching(metas, filePath, age, now, async (path) => {
        const meta = await readClaudeMeta(path)
        return meta && meta.turnCount > 0 ? meta : null
      })
    } catch { /* skip */ }
  }

  // Codex — fast meta scan
  const codexFiles = listCodexSessions()
  for (const filePath of codexFiles) {
    try {
      await pushMetaIfMatching(metas, filePath, age, now, readCodexMeta)
    } catch { /* skip */ }
  }

  // Kimi Code — state.json + main wire event stream
  const kimiFiles = listKimiSessions()
  for (const files of kimiFiles) {
    try {
      await pushMetaIfMatching(metas, files.statePath, age, now, async () => readKimiMeta(files))
    } catch { /* skip */ }
  }

  metas.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  sessionCache.set(age, { metas, cacheTime: now })
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
    } else if (source === 'kimi') {
      session = await parseKimiSession(filePath)
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
