import type { Source } from '@shared/types'
import { SourceIcon } from './SourceIcon'

export interface SourceConfig {
  label: string
  color: string
  textClass: string
  badgeBg: string
  badgeBorder: string
  glow: string
}

const CONFIGS: Record<Source, SourceConfig> = {
  claude: {
    label: 'Claude Code',
    color: '#c2410c',        // orange-700 — legible on white
    textClass: 'text-orange-700',
    badgeBg: 'rgba(234,88,12,0.08)',
    badgeBorder: 'rgba(234,88,12,0.25)',
    glow: 'rgba(234,88,12,0.12)',
  },
  codex: {
    label: 'Codex',
    color: '#1d4ed8',        // blue-700
    textClass: 'text-blue-700',
    badgeBg: 'rgba(29,78,216,0.07)',
    badgeBorder: 'rgba(29,78,216,0.2)',
    glow: 'rgba(29,78,216,0.1)',
  },
  gemini: {
    label: 'Gemini CLI',
    color: '#6d28d9',        // violet-700
    textClass: 'text-violet-700',
    badgeBg: 'rgba(109,40,217,0.07)',
    badgeBorder: 'rgba(109,40,217,0.2)',
    glow: 'rgba(109,40,217,0.1)',
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
      <SourceIcon source={source} className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{c.label}</span>
    </span>
  )
}
