#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { getDb, closeDb } from '../src/lib/db/client';
import { DD_BACKUPS_DIR, DD_DB_PATH, ensureDirs } from '../src/lib/paths';

async function main() {
  ensureDirs();
  const db = getDb();
  const dayKey = new Date().toISOString().slice(0, 10);
  const dest = path.join(DD_BACKUPS_DIR, `daily-dose-${dayKey}.db`);
  await (db as any).backup(dest);
  closeDb();
  const size = fs.statSync(dest).size;
  console.log(`[ OK ] Backup written to ${dest} (${size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
