import type { Source } from '@shared/types'

export interface SourceConfig {
  label: string
  color: string
  textClass: string
  badgeBg: string
  badgeBorder: string
  glow: string
  icon: string
}

const CONFIGS: Record<Source, SourceConfig> = {
  claude: {
    label: 'Claude',
    color: '#c2410c',        // orange-700 — legible on white
    textClass: 'text-orange-700',
    badgeBg: 'rgba(234,88,12,0.08)',
    badgeBorder: 'rgba(234,88,12,0.25)',
    glow: 'rgba(234,88,12,0.12)',
    icon: '◆',
  },
  codex: {
    label: 'Codex',
    color: '#1d4ed8',        // blue-700
    textClass: 'text-blue-700',
    badgeBg: 'rgba(29,78,216,0.07)',
    badgeBorder: 'rgba(29,78,216,0.2)',
    glow: 'rgba(29,78,216,0.1)',
    icon: '⬡',
  },
  gemini: {
    label: 'Gemini',
    color: '#6d28d9',        // violet-700
    textClass: 'text-violet-700',
    badgeBg: 'rgba(109,40,217,0.07)',
    badgeBorder: 'rgba(109,40,217,0.2)',
    glow: 'rgba(109,40,217,0.1)',
    icon: '✦',
  },
}

export function getSourceConfig(source: Source) { return CONFIGS[source] }

export function SourceBadge({ source }: { source: Source }) {
  const c = CONFIGS[source]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-bold"
      style={{ background: c.badgeBg, border: `1px solid ${c.badgeBorder}`, color: c.color }}
    >
      {c.icon} {c.label}
    </span>
  )
}
