import { getDb, newId } from '../client';
import { nowIso } from '../../time';

export interface CompactionRow {
  id: string;
  session_id: string | null;
  claude_session_id: string | null;
  trigger: string | null;
  occurred_at: string;
  snapshot_json: string | null;
}

export function recordCompaction(input: {
  session_id?: string | null;
  claude_session_id?: string | null;
  trigger?: string | null;
  snapshot?: unknown;
}): CompactionRow {
  const db = getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO compactions (id, session_id, claude_session_id, trigger, occurred_at, snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.session_id ?? null,
    input.claude_session_id ?? null,
    input.trigger ?? null,
    nowIso(),
    input.snapshot ? JSON.stringify(input.snapshot) : null
  );
  return db.prepare('SELECT * FROM compactions WHERE id = ?').get(id) as CompactionRow;
}
