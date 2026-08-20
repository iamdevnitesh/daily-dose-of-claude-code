import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const HOME = os.homedir();

export const DD_ROOT = process.env.DAILY_DOSE_HOME
  ? path.resolve(process.env.DAILY_DOSE_HOME)
  : path.join(HOME, '.daily-dose-claude');

export const DD_DATA_DIR = path.join(DD_ROOT, 'data');
export const DD_LOGS_DIR = path.join(DD_ROOT, 'logs');
export const DD_TRANSCRIPTS_DIR = path.join(DD_ROOT, 'transcripts');
export const DD_BIN_DIR = path.join(DD_ROOT, 'bin');
export const DD_BACKUPS_DIR = path.join(DD_ROOT, 'backups');

export const DD_DB_PATH = path.join(DD_DATA_DIR, 'daily-dose.db');
export const DD_HOOKS_LOG = path.join(DD_LOGS_DIR, 'hooks.log');
export const DD_CONFIG_PATH = path.join(DD_ROOT, 'config.json');

export const CLAUDE_DIR = path.join(HOME, '.claude');
export const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
export const CLAUDE_LOCAL_SETTINGS = path.join(CLAUDE_DIR, 'settings.local.json');
export const CLAUDE_MD = path.join(CLAUDE_DIR, 'CLAUDE.md');

export function ensureDirs(): void {
  for (const dir of [DD_ROOT, DD_DATA_DIR, DD_LOGS_DIR, DD_TRANSCRIPTS_DIR, DD_BIN_DIR, DD_BACKUPS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
