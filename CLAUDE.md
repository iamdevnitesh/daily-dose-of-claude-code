# Daily Dose of Claude Code — project instructions

## Layout

- `src/lib` — shared library (paths, config, logger, redaction, time, project detection, summarize)
- `src/lib/db` — SQLite client, migrations, repositories (sessions, turns, tool_events, file_changes, todos, compactions, day view)
- `src/lib/installer` — safe settings.json + CLAUDE.md merge/upsert
- `src/hooks` — one script per Claude Code hook event; each reads stdin JSON, writes to SQLite, fails open
- `src/mcp/server.ts` — local stdio MCP server exposing daily_dose_* tools
- `src/app` — Next.js App Router UI (`/`, `/day/[date]`, `/activity/[id]`, `/search`, `/settings`) + API routes
- `src/components` — newspaper UI pieces (Masthead, DateNavigator, LeadStory, ActivityTimeline, TodoDesk, DayStats, EmptyEdition, ThemeToggle, EndOfEdition)
- `scripts` — install / uninstall / doctor / migrate / seed / backup
- `tests` — vitest suite (temp DAILY_DOSE_HOME per test)

## Golden rules

1. Never overwrite `~/.claude/settings.json` — merge additively and back up first.
2. Never persist tokens, API keys, private keys, `.env` values. Send all writes through `redactText` / `redactBashCommand`.
3. Hooks are observational — they never block Claude Code, never make network calls, never call external LLMs.
4. Store timestamps in UTC (ISO); render in local time; group by local calendar day.
5. Don’t dump full tool responses into SQLite — store concise summaries.
6. UI does not need to be running for capture. Data is authoritative in `~/.daily-dose-claude/data/daily-dose.db`.
