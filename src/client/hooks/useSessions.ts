import { useState, useEffect } from 'react'
import type { SessionAgeRange, SessionMeta, TraceSession } from '@shared/types'
import { apiUrl } from '../utils/api'

export function useSessions(ageRange: SessionAgeRange = '1d') {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ age: ageRange })
    fetch(apiUrl(`/api/sessions?${params}`))
      .then((r) => r.json())
      .then((data) => {
        setSessions(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [ageRange])

  return { sessions, loading, error }
}

export function useSession(meta: SessionMeta | null) {
  const [session, setSession] = useState<TraceSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!meta) {
      setSession(null)
      return
    }
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ source: meta.source, filePath: meta.filePath })
    fetch(apiUrl(`/api/sessions/${encodeURIComponent(meta.id)}?${params}`))
      .then((r) => r.json())
      .then((data) => {
        setSession(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [meta?.id, meta?.filePath])

  return { session, loading, error }
}
