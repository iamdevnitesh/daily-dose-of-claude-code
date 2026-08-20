import { getDb } from '../client';
import { nowIso } from '../../time';

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings_kv WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings_kv (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, nowIso());
}

export function listSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings_kv').all() as { key: string; value: string }[];
  return rows.reduce<Record<string, string>>((acc, r) => {
    acc[r.key] = r.value;
    return acc;
  }, {});
}
