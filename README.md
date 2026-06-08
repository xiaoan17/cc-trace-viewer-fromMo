# Trace Viewer

<p align="center">
  <img src="./public/logo.png" alt="Trace Viewer logo" width="180" />
</p>

A web-based viewer for browsing and comparing conversation traces from multiple coding agents: **Claude Code**, **Codex**, and **Kimi Code**.

![screenshot placeholder](./docs/screenshot.png)

## Features

- Browse sessions from all supported agents in a unified interface
- Filter by time range and source (Claude / Codex / Kimi), and search by project path
- Timeline view of each session: user messages, tool calls, tool results, thinking steps, and assistant responses
- Full markdown rendering in message content
- Token usage display per turn (where available)
- Fast session list loading via lightweight metadata scan

## Supported Sources

| Source | Trace Location | Format |
|--------|---------------|--------|
| Claude Code | `~/.claude/projects/**/*.jsonl` | JSONL, `parentUuid` linked list |
| Codex | `~/.codex/sessions/**/*.jsonl` | JSONL, event stream |
| Kimi Code | `~/.kimi-code/sessions/**/state.json` + `agents/main/wire.jsonl` | JSON + JSONL event stream |

## Getting Started

```bash
npm run setup
npm start
```

Or, if you prefer the explicit two-step flow:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

On macOS, you can also double-click [Trace Viewer.command](/Users/anbc/Desktop/trace_viewer/Trace%20Viewer.command). It starts the local servers and opens the app in your default browser once the frontend is ready.

The API server runs on port 3001; the Vite dev server proxies `/api` requests to it automatically.

## Desktop App

Build and run the Electron desktop app locally:

```bash
npm run app:dev
```

Build a macOS `.app` bundle:

```bash
npm run app:build
open "release/mac-arm64/Trace Viewer.app"
```

The desktop app starts its own local API server internally, so it does not require a separate Vite or Express dev server.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Check local Node.js version and install dependencies |
| `npm start` | One-command local launch; installs dependencies first if needed |
| `./Trace Viewer.command` | macOS double-click launcher that opens the app in a browser |
| `npm run dev` | Start both API server and Vite dev server |
| `npm run server:dev` | Start only the API server with hot-reload |
| `npm run build` | Type-check and build for production |
| `npm run app:dev` | Build and launch the Electron app locally |
| `npm run app:build` | Build a macOS `.app` bundle in `release/mac-arm64` |
| `npm run app:dist` | Build macOS distributables with electron-builder |
| `npm run preview` | Preview the production build |

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js (Node) — reads trace files directly from the filesystem, no database
- **Markdown**: react-markdown + remark-gfm
