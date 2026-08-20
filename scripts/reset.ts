#!/usr/bin/env tsx
// Empties the Daily Dose database (keeps schema).
// Safety: prompts unless --yes is passed. Also writes a backup first.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getDb, closeDb } from '../src/lib/db/client';
import { DD_BACKUPS_DIR, DD_DB_PATH, ensureDirs } from '../src/lib/paths';

async function main() {
  ensureDirs();
  const auto = process.argv.includes('--yes') || process.argv.includes('-y');
  if (!fs.existsSync(DD_DB_PATH)) {
    console.log(`[INFO] No database at ${DD_DB_PATH}; nothing to reset.`);
    return;
  }

  if (!auto) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(
      `This will erase all sessions, turns, TODOs, and tool events in ${DD_DB_PATH}.\n` +
        `A backup will be written to ${DD_BACKUPS_DIR}.\n\nProceed? [y/N] `
    );
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log('Aborted.');
      return;
    }
  }

  const db = getDb();
  const bakName = `pre-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  const bakPath = path.join(DD_BACKUPS_DIR, bakName);
  await (db as any).backup(bakPath);
  console.log(`[ OK ] Backup written to ${bakPath}`);

  const tx = db.transaction(() => {
    const tables = [
      'tool_events',
      'file_changes',
      'turns',
      'compactions',
      'sessions',
      'todos',
      'settings_kv',
      'turns_fts',
      'todos_fts'
    ];
    for (const t of tables) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
  });
  tx();
  closeDb();
  console.log(`[ OK ] All rows removed. Schema preserved.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
