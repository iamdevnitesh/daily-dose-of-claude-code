#!/usr/bin/env tsx
// `daily-dose diagnose` — prints an actionable snapshot when hooks aren't producing data.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CLAUDE_SETTINGS, CLAUDE_LOCAL_SETTINGS, DD_DB_PATH, DD_HOOKS_LOG, DD_ROOT, ensureDirs } from '../src/lib/paths';
import { readJsonIfExists, type ClaudeSettings } from '../src/lib/installer/settingsMerge';
import { getDb } from '../src/lib/db/client';

function head(title: string) {
  console.log('');
  console.log(`── ${title} ─────────────────────────────`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function warn(msg: string) {
  console.log(`  ! ${msg}`);
}
function bad(msg: string) {
  console.log(`  ✗ ${msg}`);
}

function main() {
  ensureDirs();

  console.log('');
  console.log('🗞  Daily Dose diagnose');
  console.log(`   DAILY_DOSE_HOME=${DD_ROOT}`);

  head('Hooks configured');
  const collected = new Set<string>();
  for (const p of [CLAUDE_SETTINGS, CLAUDE_LOCAL_SETTINGS]) {
    const s = readJsonIfExists<ClaudeSettings>(p);
    if (!s?.hooks) continue;
    for (const evt of Object.keys(s.hooks)) {
      const entries = s.hooks[evt];
      if (!Array.isArray(entries)) continue;
      for (const e of entries) {
        for (const h of e.hooks || []) {
          if ((h.command || '').includes('daily-dose')) collected.add(evt);
        }
      }
    }
  }
  const expected = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'PreCompact', 'SessionEnd'];
  for (const e of expected) {
    collected.has(e) ? ok(e) : bad(`${e} — MISSING (re-run: daily-dose install)`);
  }

  head('MCP server');
  const s1 = readJsonIfExists<ClaudeSettings>(CLAUDE_SETTINGS);
  const s2 = readJsonIfExists<ClaudeSettings>(CLAUDE_LOCAL_SETTINGS);
  const mcp = s1?.mcpServers?.['daily-dose'] || s2?.mcpServers?.['daily-dose'];
  if (mcp) {
    ok(`registered → ${mcp.command} ${(mcp.args || []).join(' ')}`);
    const target = (mcp.args || [])[0] || mcp.command;
    if (target && !fs.existsSync(String(target))) {
      bad(`MCP command file missing: ${target}  →  cd repo && npm run build:node`);
    }
  } else {
    bad('daily-dose MCP not registered — re-run: daily-dose install');
  }

  head('Compiled hook binaries');
  const distDir = path.join(path.dirname(path.dirname(new URL(import.meta.url).pathname)), 'dist', 'hooks');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'));
    ok(`${files.length} scripts present at ${distDir}`);
  } else {
    bad(`dist/hooks not built. Run: npm run build:node`);
  }

  head('Database');
  try {
    const db = getDb();
    const sessions = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number }).c;
    const turns = (db.prepare('SELECT COUNT(*) as c FROM turns').get() as { c: number }).c;
    const todos = (db.prepare('SELECT COUNT(*) as c FROM todos').get() as { c: number }).c;
    ok(`${DD_DB_PATH}`);
    ok(`sessions=${sessions}  turns=${turns}  todos=${todos}`);
    if (sessions === 0 && turns === 0) {
      warn('DB is empty — no hook has fired yet. See "Next steps" below.');
    }
    const last = db
      .prepare('SELECT started_at FROM turns ORDER BY started_at DESC LIMIT 1')
      .get() as { started_at: string } | undefined;
    if (last) ok(`most recent turn: ${last.started_at}`);
  } catch (err) {
    bad(`DB unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }

  head('Hook log (last 10 entries)');
  if (fs.existsSync(DD_HOOKS_LOG)) {
    const lines = fs.readFileSync(DD_HOOKS_LOG, 'utf8').trim().split('\n').slice(-10);
    if (lines.length === 0 || lines[0] === '') {
      warn(`log file exists but is empty: ${DD_HOOKS_LOG}`);
    } else {
      for (const l of lines) {
        try {
          const e = JSON.parse(l);
          console.log(`  ${e.ts}  ${e.level.padEnd(5)} ${e.source.padEnd(20)} ${e.msg}`);
        } catch {
          console.log('  ' + l);
        }
      }
    }
  } else {
    warn(`no log file yet at ${DD_HOOKS_LOG} — hooks have not fired`);
  }

  head('Claude Code CLI');
  try {
    const v = execFileSync('claude', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    ok(`installed: ${v}`);
  } catch {
    bad('`claude` CLI not on PATH');
  }

  console.log('');
  console.log('── Next steps ─────────────────────────────');
  console.log('  If hooks/MCP are configured but the log/DB are empty:');
  console.log('    1. Fully QUIT any running Claude Code sessions (Cmd+Q or close all terminals).');
  console.log('    2. Start a NEW Claude Code session and submit any prompt.');
  console.log('    3. Re-run `daily-dose diagnose` — the hook log should now have entries.');
  console.log('');
  console.log('  If items above show ✗ — re-run: `cd ~/daily-dose-of-claude-code && npm run install:daily-dose`');
  console.log('');
}

main();
