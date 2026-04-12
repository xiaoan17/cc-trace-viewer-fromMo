type Role = 'user' | 'assistant'

export function RoleAvatar({ role, className = 'w-7 h-7' }: { role: Role; className?: string }) {
  const baseClassName = `relative flex items-center justify-center rounded-xl border shadow-sm ${className}`

  if (role === 'user') {
    return (
      <div className={`${baseClassName} bg-gradient-to-br from-accent-user/20 via-surface-0 to-accent-user/10 border-accent-user/25 text-accent-user`}>
        <div className="absolute inset-[2px] rounded-[10px] bg-gradient-to-br from-white/80 to-transparent dark:from-white/10 dark:to-transparent pointer-events-none" />
        <UserGlyph className="relative w-[58%] h-[58%]" />
      </div>
    )
  }

  return (
    <div className={`${baseClassName} bg-gradient-to-br from-accent-agent/20 via-surface-0 to-accent-agent/10 border-accent-agent/25 text-accent-agent`}>
      <div className="absolute inset-[2px] rounded-[10px] bg-gradient-to-br from-white/80 to-transparent dark:from-white/10 dark:to-transparent pointer-events-none" />
      <AssistantGlyph className="relative w-[62%] h-[62%]" />
    </div>
  )
}

function UserGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.25" r="2.35" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.75 12.25c.66-1.88 2.2-2.82 4.25-2.82 2.05 0 3.59.94 4.25 2.82" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function AssistantGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.2v1.55" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <rect x="3.3" y="4.2" width="9.4" height="7.2" rx="2.4" stroke="currentColor" strokeWidth="1.35" />
      <path d="M5.1 11.4v1.45M10.9 11.4v1.45M3.3 7.35H1.95M14.05 7.35H12.7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="6.4" cy="7.2" r="0.75" fill="currentColor" />
      <circle cx="9.6" cy="7.2" r="0.75" fill="currentColor" />
      <path d="M6.1 9.25c.45.35 1 .52 1.9.52s1.45-.17 1.9-.52" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
