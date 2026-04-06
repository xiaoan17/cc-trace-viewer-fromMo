import { useState } from 'react'
import { SessionList } from './components/SessionList'
import { TraceViewer } from './components/TraceViewer'
import type { SessionMeta } from '@shared/types'

export default function App() {
  const [selected, setSelected] = useState<SessionMeta | null>(null)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-0)' }}>
      <div
        className="w-80 flex-shrink-0 flex flex-col overflow-hidden"
        style={{ borderRight: '1.5px solid var(--border-2)' }}
      >
        <SessionList selected={selected} onSelect={setSelected} />
      </div>
      <div className="flex-1 overflow-hidden">
        {selected ? <TraceViewer meta={selected} /> : <EmptyState />}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
      <div
        className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
        style={{ background: 'var(--bg-2)', border: '1.5px solid var(--border-2)' }}
      >
        <span style={{ opacity: 0.25 }}>⌬</span>
      </div>
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--text-2)' }}>No session selected</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-4)' }}>
          Pick a session from the sidebar
        </p>
      </div>
    </div>
  )
}
