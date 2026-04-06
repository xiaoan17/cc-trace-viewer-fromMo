# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start both the API server (port 3001) and the Vite dev server (port 5173)
npm run dev

# Start only the API server with hot-reload
npm run server:dev

# Type-check without emitting
npx tsc --noEmit

# Build for production
npm run build
```

## Architecture

**Full-stack TypeScript** project — an Express backend + React/Vite frontend — for browsing and comparing agent traces from Claude Code, Codex, and Gemini CLI.

### Data flow

```
~/.claude/projects/**/*.jsonl     ─┐
~/.codex/sessions/**/*.jsonl      ─┤─► Parsers ─► Express API ─► React frontend
~/.gemini/tmp/**/chats/*.json     ─┘
```

### Unified schema (`src/shared/types.ts`)

All three formats are normalized into `TraceSession → TraceTurn[] → TraceStep[]`. Turn = one user→agent exchange. Steps are individual tool calls, tool results, thinking, and text chunks.

### Backend (`src/server/`)

- `index.ts` — Express entrypoint on port 3001
- `api.ts` — `GET /api/sessions` (returns `SessionMeta[]`) and `GET /api/sessions/:id?source=&filePath=`
- `parsers/claude.ts` — walks `~/.claude/projects/` JSONL files; reconstructs turns by following `parentUuid` linked list
- `parsers/codex.ts` — walks `~/.codex/sessions/` JSONL files; groups turns by `event_msg` `task_started`/`task_complete` boundaries
- `parsers/gemini.ts` — reads `~/.gemini/tmp/` JSON chat files; turns are `user` message followed by `gemini` response with embedded `toolCalls[]`

### Frontend (`src/client/`)

- `App.tsx` — two-column layout: `SessionList` (left) + `TraceViewer` (right)
- `hooks/useSessions.ts` — `useSessions()` fetches session list; `useSession(meta)` fetches full session on demand
- `components/SessionList.tsx` — filter by source (Claude/Codex/Gemini) + text search, grouped by source with counts
- `components/TraceViewer.tsx` — header with metadata + scrollable turn list
- `components/TurnCard.tsx` — renders one turn: user bubble, collapsible steps, assistant response, token usage
- `components/StepItem.tsx` — renders individual steps with type-specific styling (tool_use, tool_result, thinking, text)
- `components/SourceBadge.tsx` — source color config (amber=Claude, sky=Codex, violet=Gemini)

### Path alias

`@shared/*` maps to `src/shared/*` for types shared between server and client.
