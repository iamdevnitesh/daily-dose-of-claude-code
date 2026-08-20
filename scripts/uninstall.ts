#!/usr/bin/env tsx
import fs from 'node:fs';
import { CLAUDE_MD, CLAUDE_SETTINGS, DD_DATA_DIR, DD_ROOT } from '../src/lib/paths';
import {
  backupFile,
  readJsonIfExists,
  removeDailyDoseHooks,
  removeMcp,
  writeJsonPreservingPermissions,
  type ClaudeSettings
} from '../src/lib/installer/settingsMerge';
import { removeClaudeMdSection } from '../src/lib/installer/claudeMd';

function main() {
  console.log('');
  console.log('  Uninstalling Daily Dose of Claude Code…');
  console.log('');
  const purge = process.argv.includes('--purge-data');

  const s: ClaudeSettings | null = readJsonIfExists<ClaudeSettings>(CLAUDE_SETTINGS);
  if (s) {
    const bak = backupFile(CLAUDE_SETTINGS);
    if (bak) console.log(`[ OK ] Backup: ${bak}`);
    let next = removeDailyDoseHooks(s);
    next = removeMcp(next, 'daily-dose');
    writeJsonPreservingPermissions(CLAUDE_SETTINGS, next);
    console.log('[ OK ] Removed Daily Dose hooks and MCP from settings.json');
  } else {
    console.log('[INFO] No ~/.claude/settings.json to clean');
  }

  if (fs.existsSync(CLAUDE_MD)) {
    const removed = removeClaudeMdSection(CLAUDE_MD);
    console.log(removed ? '[ OK ] Removed managed CLAUDE.md section' : '[INFO] No managed section in CLAUDE.md');
  }

  if (purge) {
    if (fs.existsSync(DD_ROOT)) {
      fs.rmSync(DD_ROOT, { recursive: true, force: true });
      console.log(`[ OK ] Purged ${DD_ROOT}`);
    }
  } else {
    console.log('');
    console.log(`  Data preserved at ${DD_DATA_DIR}`);
    console.log('  Re-run with --purge-data to delete the database and logs.');
  }
  console.log('');
  console.log('  Uninstalled.');
}

main();
