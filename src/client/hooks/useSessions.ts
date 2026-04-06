import { useState, useEffect } from 'react'
import type { SessionMeta, TraceSession } from '@shared/types'

export function useSessions() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((data) => {
        setSessions(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [])

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
    fetch(`/api/sessions/${encodeURIComponent(meta.id)}?${params}`)
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
