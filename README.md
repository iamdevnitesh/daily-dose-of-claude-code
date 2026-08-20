# 🗞 Daily Dose of Claude Code

A local newspaper-style memory system for everything you do with Claude Code.
Nothing leaves your machine.

- Persistent SQLite database of every Claude Code session, prompt, tool call, and file edit — across every repo
- Newspaper UI at `http://localhost:3000` with light/dark warm theme, date navigation, timeline, TODO desk, stats, and search
- First-class TODOs, editable in the UI and manipulable by Claude via a local MCP server
- Global Claude Code hooks (SessionStart, UserPromptSubmit, PostToolUse, Stop, PreCompact, SessionEnd), **additively merged** into your existing `~/.claude/settings.json` (never overwritten, always backed up)
- Redaction of common secret formats before any write
- No cloud, no API keys, no external LLM calls

---

## Installation

### Option 1 — One-line installer (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/iamdevnitesh/daily-dose-of-claude-code/main/install.sh | bash
```

Or, if you've already cloned this repo:

```bash
./install.sh
```

It clones to `~/daily-dose-of-claude-code`, installs deps, builds the hooks/MCP,
merges into `~/.claude/settings.json` (backing up first), adds a small managed
section to `~/.claude/CLAUDE.md`, and runs the doctor.

### Option 2 — npm

Once published, anyone can install globally:

```bash
npm install -g daily-dose-of-claude-code
daily-dose install
daily-dose dev              # UI on http://localhost:3000
```

Or run without installing:

```bash
npx daily-dose-of-claude-code install
```

### Option 3 — Docker Compose (UI only)

The **hooks and MCP server must run on the host** — Claude Code spawns them
as subprocesses and can't reach into a container. Docker is useful for the
newspaper **UI only**, which reads/writes the shared SQLite database via a
volume mount.

```bash
# 1. Install hooks + MCP on the host first (any of the options above)
npx daily-dose-of-claude-code install

# 2. Run the UI in Docker
docker compose up -d
# → http://localhost:3000
```

The compose file mounts `~/.daily-dose-claude` (or `$DAILY_DOSE_HOME`) into the
container at `/data`, so the UI shares the exact same database the host-side
hooks and MCP server are writing to. Kill the container any time — capture keeps
running because it lives on the host.

### Option 4 — Manual (developer / hackable)

```bash
git clone <repo> && cd daily-dose-of-claude-code
npm install
npm run build:node          # compile hooks + MCP
npm run install:daily-dose  # merge into ~/.claude/settings.json (backup first)
npm run doctor
npm run dev                 # http://localhost:3000
```

---

## The `daily-dose` CLI

Once installed globally (or via `npx`), the `daily-dose` command dispatches to
everything:

| Command | What it does |
|---|---|
| `daily-dose install` | Merge hooks + MCP into `~/.claude/settings.json`, add managed CLAUDE.md section |
| `daily-dose uninstall [--purge-data]` | Remove hooks/MCP; keep data unless `--purge-data` |
| `daily-dose doctor` | Verify everything is wired up |
| `daily-dose dev` | Start the newspaper UI in dev mode |
| `daily-dose start` | Start the UI in production mode |
| `daily-dose build` | Compile hooks/MCP + build the Next.js UI |
| `daily-dose seed [--force]` | Add demo activity for today |
| `daily-dose reset [--yes]` | Empty the DB (backup first; schema preserved) |
| `daily-dose backup` | Snapshot the DB into `~/.daily-dose-claude/backups` |
| `daily-dose migrate` | Print schema state |

---

## Where things live

| Path | Purpose |
|---|---|
| `~/.daily-dose-claude/data/daily-dose.db` | SQLite database (WAL, FTS5) |
| `~/.daily-dose-claude/logs/hooks.log` | JSON-line hook log |
| `~/.daily-dose-claude/config.json` | Capture toggles + theme |
| `~/.daily-dose-claude/backups/` | Timestamped DB backups |
| `~/.claude/settings.json` | Hooks + MCP registration (backed up before every write) |
| `~/.claude/CLAUDE.md` | Contains a small `<!-- DAILY_DOSE_START -->` managed section |

---

## Architecture

```
Claude Code
  │
  ├─ Hooks (host-side Node): SessionStart, UserPromptSubmit,
  │                          PostToolUse, Stop, PreCompact, SessionEnd
  │                          → write to SQLite
  │
  └─ MCP server (host-side stdio, daily-dose)
                          → same SQLite DB

     Next.js UI (host or Docker, localhost:3000)
                          → same SQLite DB
```

The UI does **not** need to be running for activity capture — hooks talk
directly to SQLite. You can kill Docker, kill `next dev`, uninstall the UI —
Claude activity will keep landing in your local database.

## MCP tools

- `daily_dose_add_todo`
- `daily_dose_list_todos`
- `daily_dose_update_todo`
- `daily_dose_complete_todo` (accepts `title_query` or `id`)
- `daily_dose_delete_todo`
- `daily_dose_search_memory` (FTS5 over activities + TODOs)
- `daily_dose_get_day`
- `daily_dose_get_recent_activity`
- `daily_dose_remember`

## Testing

```bash
npm test
```

Tests run against a temporary `DAILY_DOSE_HOME` — your real database and Claude
configuration are never touched.

## Notes and non-goals

- No external AI calls — titles/summaries are deterministic
- Full tool outputs (like giant `Read` payloads) are never persisted; only concise metadata
- Redaction runs on all writes; still, don't intentionally paste secrets
- Hooks are fail-open — Daily Dose failures never block Claude Code
- Docker is UI-only by design; hooks must live on host for Claude Code to spawn them
