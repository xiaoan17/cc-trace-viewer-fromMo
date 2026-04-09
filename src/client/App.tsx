import { useState, useEffect } from 'react'
import { SessionList } from './components/SessionList'
import { TraceViewer } from './components/TraceViewer'
import type { SessionMeta } from '@shared/types'

export default function App() {
  const [selected, setSelected] = useState<SessionMeta | null>(null)
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark'
  )

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0 text-text-1">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden border-r border-border-2 bg-surface-1">
        <SessionList selected={selected} onSelect={setSelected} />
        
        {/* Bottom Bar with Theme Toggle */}
        <div className="p-3 border-t border-border-2 flex items-center justify-between bg-surface-1">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="btn-icon"
            title="Toggle Theme"
          >
            {darkMode ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <div className="text-[10px] font-medium text-text-4 uppercase tracking-wider">
            Trace Viewer v2.0
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {selected ? (
          <TraceViewer meta={selected} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 select-none bg-surface-0">
      <div className="relative">
        <div className="absolute inset-0 bg-accent-user opacity-10 blur-2xl rounded-full" />
        <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center text-4xl bg-surface-2 border border-border-2 shadow-md">
          <span className="opacity-30">⌬</span>
        </div>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-text-1">No session selected</h3>
        <p className="text-sm mt-1.5 text-text-3 max-w-[240px] mx-auto">
          Select a session from the sidebar to view the full execution trace.
        </p>
      </div>
    </div>
  )
}
