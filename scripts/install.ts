#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  CLAUDE_DIR,
  CLAUDE_MD,
  CLAUDE_SETTINGS,
  DD_BIN_DIR,
  DD_DB_PATH,
  DD_ROOT,
  ensureDirs
} from '../src/lib/paths';
import {
  backupFile,
  ensureHookMerged,
  ensureMcpMerged,
  readJsonIfExists,
  writeJsonPreservingPermissions,
  type ClaudeSettings
} from '../src/lib/installer/settingsMerge';
import { upsertClaudeMdSection } from '../src/lib/installer/claudeMd';
import { getDb } from '../src/lib/db/client';
import { loadConfig } from '../src/lib/config';

const __dirname_es = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname_es, '..');
const DIST = path.join(REPO_ROOT, 'dist');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

function log(msg: string, level: 'info' | 'warn' | 'error' | 'ok' = 'info') {
  const prefix = level === 'ok' ? '✓' : level === 'warn' ? '!' : level === 'error' ? '✗' : '·';
  const tag = level === 'error' ? '[ERR ]' : level === 'warn' ? '[WARN]' : level === 'ok' ? '[ OK ]' : '[INFO]';
  console.log(`${tag} ${prefix} ${msg}`);
}

function ensureCompiled() {
  const compiled = fs.existsSync(path.join(DIST, 'hooks', 'session-start.js'));
  if (compiled) return;
  log('Compiling TypeScript (tsc -p tsconfig.node.json)…');
  try {
    execFileSync('npx', ['tsc', '-p', 'tsconfig.node.json'], { cwd: REPO_ROOT, stdio: 'inherit' });
  } catch (err) {
    log('tsc failed; hooks will be run via tsx as fallback', 'warn');
  }
}

function hookCommandFor(name: string): string {
  const compiled = path.join(DIST, 'hooks', `${name}.js`);
  if (fs.existsSync(compiled)) {
    return `node ${compiled}`;
  }
  const src = path.join(REPO_ROOT, 'src', 'hooks', `${name}.ts`);
  return `node ${TSX_BIN} ${src}`;
}

function mcpCommand(): { command: string; args: string[] } {
  const compiled = path.join(DIST, 'mcp', 'server.js');
  if (fs.existsSync(compiled)) {
    return { command: 'node', args: [compiled] };
  }
  const src = path.join(REPO_ROOT, 'src', 'mcp', 'server.ts');
  return { command: 'node', args: [TSX_BIN, src] };
}

async function main() {
  console.log('');
  console.log('  Installing Daily Dose of Claude Code…');
  console.log('');

  ensureDirs();
  log(`Data directory: ${DD_ROOT}`, 'ok');

  const db = getDb();
  db.prepare('SELECT 1').get();
  log(`Database initialised at ${DD_DB_PATH}`, 'ok');
  loadConfig();

  ensureCompiled();

  const hookMap: Record<string, string> = {
    SessionStart: 'session-start',
    UserPromptSubmit: 'user-prompt-submit',
    PostToolUse: 'post-tool-use',
    Stop: 'stop',
    PreCompact: 'pre-compact',
    SessionEnd: 'session-end'
  };

  const existingSettings: ClaudeSettings = readJsonIfExists<ClaudeSettings>(CLAUDE_SETTINGS) || {};
  const bak = backupFile(CLAUDE_SETTINGS);
  if (bak) log(`Backup: ${bak}`, 'ok');

  let settings = existingSettings;

  const timeout = 8;
  for (const [event, name] of Object.entries(hookMap)) {
    const cmd = hookCommandFor(name);
    settings = ensureHookMerged(settings, event, {
      hooks: [{ type: 'command', command: cmd, timeout }]
    });
    log(`Merged ${event} hook`, 'ok');
  }

  const mcp = mcpCommand();
  settings = ensureMcpMerged(settings, 'daily-dose', {
    type: 'stdio',
    command: mcp.command,
    args: mcp.args,
    env: {}
  });
  log('Registered daily-dose MCP server (user scope)', 'ok');

  writeJsonPreservingPermissions(CLAUDE_SETTINGS, settings);
  log(`Wrote ${CLAUDE_SETTINGS}`, 'ok');

  const mdBak = backupFile(CLAUDE_MD);
  if (mdBak) log(`Backup: ${mdBak}`, 'ok');
  const mdResult = upsertClaudeMdSection(CLAUDE_MD);
  log(`CLAUDE.md managed section ${mdResult}`, 'ok');

  copyBinLinks();

  console.log('');
  log('Installation complete.', 'ok');
  console.log('');
  console.log('  ⚠  IMPORTANT: Hooks only take effect for NEW Claude Code sessions.');
  console.log('     Fully quit any running Claude Code sessions and start a new one.');
  console.log('');
  console.log('  Next steps:');
  console.log('    • Quit + relaunch Claude Code, submit any prompt');
  console.log('    • npm run dev             (UI at http://localhost:3000)');
  console.log('    • daily-dose diagnose     (if no activity shows up)');
  console.log('');
  console.log(`  Claude data root: ${CLAUDE_DIR}`);
  console.log(`  Daily Dose root:  ${DD_ROOT}`);
  console.log('');
}

function copyBinLinks() {
  const compiled = fs.existsSync(path.join(DIST, 'hooks', 'session-start.js'));
  if (!compiled) return;
  const target = path.join(DD_BIN_DIR, 'dist');
  try {
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    fs.symlinkSync(DIST, target, 'dir');
  } catch {
    // ignore symlink errors on non-posix
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
