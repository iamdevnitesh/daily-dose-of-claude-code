#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CLAUDE_MD, CLAUDE_SETTINGS, DD_DB_PATH, DD_ROOT, ensureDirs } from '../src/lib/paths';
import { readJsonIfExists, type ClaudeSettings } from '../src/lib/installer/settingsMerge';
import { getDb } from '../src/lib/db/client';
import { CURRENT_SCHEMA_VERSION } from '../src/lib/db/migrations';

const REQUIRED_HOOKS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'PreCompact', 'SessionEnd'];

function pass(label: string, ok: boolean, detail?: string): boolean {
  const mark = ok ? '✓' : '✗';
  const tag = ok ? '[ OK ]' : '[FAIL]';
  console.log(`${tag} ${mark} ${label}${detail ? ' — ' + detail : ''}`);
  return ok;
}

function main() {
  console.log('');
  console.log('  Daily Dose Doctor');
  console.log('');
  ensureDirs();

  let allOk = true;

  try {
    execFileSync('claude', ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    pass('Claude Code CLI installed', true);
  } catch {
    allOk = pass('Claude Code CLI installed', false, 'claude --version failed') && allOk;
  }

  try {
    const db = getDb();
    const row = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number | null };
    pass('Database reachable', true, DD_DB_PATH);
    pass('Schema current', (row?.v ?? 0) === CURRENT_SCHEMA_VERSION, `v${row?.v ?? 0}/${CURRENT_SCHEMA_VERSION}`);
  } catch (err) {
    allOk = pass('Database reachable', false, String(err)) && allOk;
  }

  const settings: ClaudeSettings | null = readJsonIfExists<ClaudeSettings>(CLAUDE_SETTINGS);
  const foundHooks = new Set<string>();
  if (settings?.hooks) {
    for (const evt of Object.keys(settings.hooks)) {
      const entries = settings.hooks[evt];
      if (Array.isArray(entries)) {
        for (const e of entries) {
          for (const h of e.hooks || []) {
            if ((h.command || '').includes('daily-dose')) foundHooks.add(evt);
          }
        }
      }
    }
  }
  for (const h of REQUIRED_HOOKS) {
    const ok = foundHooks.has(h);
    if (!ok) allOk = false;
    pass(`${h} hook configured`, ok);
  }

  const mcpOk = !!settings?.mcpServers?.['daily-dose'];
  if (!mcpOk) allOk = false;
  pass('daily-dose MCP configured', mcpOk);

  if (mcpOk) {
    const mcp = settings!.mcpServers!['daily-dose'];
    const target = mcp.args?.slice(-1)[0] || mcp.command;
    const ok = target && fs.existsSync(String(target).split(' ').pop() || target);
    pass('MCP server executable resolvable', !!ok, target);
  }

  const mdExists = fs.existsSync(CLAUDE_MD);
  const md = mdExists ? fs.readFileSync(CLAUDE_MD, 'utf8') : '';
  const managed = md.includes('<!-- DAILY_DOSE_START -->');
  pass('CLAUDE.md managed section installed', mdExists && managed);
  if (!(mdExists && managed)) allOk = false;

  const logFile = path.join(DD_ROOT, 'logs', 'hooks.log');
  pass('Logs directory writable', fs.existsSync(path.dirname(logFile)));

  console.log('');
  console.log(allOk ? '  All checks passed.' : '  Some checks failed — run `npm run install:daily-dose` to fix.');
  console.log('');
  process.exit(allOk ? 0 : 1);
}

main();
