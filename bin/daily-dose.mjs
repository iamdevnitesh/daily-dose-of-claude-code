#!/usr/bin/env node
// CLI entrypoint for `daily-dose` — dispatches to install/uninstall/doctor/etc.
// Works whether the package is installed globally, locally, or run from source.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const cmd = process.argv[2] || 'help';
const rest = process.argv.slice(3);

function locateTsx() {
  const candidates = [
    path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(REPO_ROOT, '..', 'tsx', 'dist', 'cli.mjs') // hoisted in monorepo
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function runTsx(script, args = []) {
  const tsx = locateTsx();
  if (!tsx) {
    console.error('daily-dose: tsx not found. Run `npm install` first.');
    process.exit(1);
  }
  const res = spawnSync('node', [tsx, script, ...args], { stdio: 'inherit' });
  process.exit(res.status ?? 1);
}

function runNode(script, args = []) {
  const res = spawnSync('node', [script, ...args], { stdio: 'inherit' });
  process.exit(res.status ?? 1);
}

function ensureBuilt() {
  const marker = path.join(REPO_ROOT, 'dist', 'hooks', 'session-start.js');
  if (fs.existsSync(marker)) return;
  console.log('Building Node bundle (first run)…');
  const res = spawnSync('npm', ['run', 'build:node'], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function ensureNextBuilt() {
  const marker = path.join(REPO_ROOT, '.next');
  if (fs.existsSync(marker)) return;
  console.log('Building Next.js UI (first run)…');
  const res = spawnSync('npx', ['next', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function help() {
  console.log(`daily-dose — local newspaper memory for Claude Code

Usage:
  daily-dose install [--yes]     Install hooks, MCP, and CLAUDE.md section
  daily-dose uninstall [--purge-data]
  daily-dose doctor              Verify everything is wired correctly
  daily-dose dev                 Start the newspaper UI (dev mode, http://localhost:3000)
  daily-dose start               Start the newspaper UI (production, requires build)
  daily-dose build               Compile hooks/MCP + Next.js UI
  daily-dose migrate             Run/print DB schema state
  daily-dose seed [--force]      Add demo activity for the current day
  daily-dose backup              Copy the DB into ~/.daily-dose-claude/backups
  daily-dose reset [--yes]       Empty the DB (keeps schema)
  daily-dose --help              This help text

Data root: ~/.daily-dose-claude/
`);
}

switch (cmd) {
  case 'install': {
    ensureBuilt();
    runTsx(path.join(REPO_ROOT, 'scripts/install.ts'), rest);
    break;
  }
  case 'uninstall':
    runTsx(path.join(REPO_ROOT, 'scripts/uninstall.ts'), rest);
    break;
  case 'doctor':
    runTsx(path.join(REPO_ROOT, 'scripts/doctor.ts'), rest);
    break;
  case 'migrate':
    runTsx(path.join(REPO_ROOT, 'scripts/migrate.ts'), rest);
    break;
  case 'seed':
    ensureBuilt();
    runTsx(path.join(REPO_ROOT, 'scripts/seed.ts'), rest);
    break;
  case 'backup':
    runTsx(path.join(REPO_ROOT, 'scripts/backup.ts'), rest);
    break;
  case 'reset':
    runTsx(path.join(REPO_ROOT, 'scripts/reset.ts'), rest);
    break;
  case 'build': {
    const b1 = spawnSync('npm', ['run', 'build:node'], { cwd: REPO_ROOT, stdio: 'inherit' });
    if (b1.status !== 0) process.exit(b1.status ?? 1);
    const b2 = spawnSync('npx', ['next', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' });
    process.exit(b2.status ?? 1);
    break;
  }
  case 'dev': {
    const p = spawn('npx', ['next', 'dev', '-p', process.env.PORT || '3000'], {
      cwd: REPO_ROOT,
      stdio: 'inherit'
    });
    p.on('exit', (code) => process.exit(code ?? 0));
    break;
  }
  case 'start': {
    ensureNextBuilt();
    const p = spawn('npx', ['next', 'start', '-p', process.env.PORT || '3000'], {
      cwd: REPO_ROOT,
      stdio: 'inherit'
    });
    p.on('exit', (code) => process.exit(code ?? 0));
    break;
  }
  case '--help':
  case '-h':
  case 'help':
  case undefined:
    help();
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    help();
    process.exit(2);
}
