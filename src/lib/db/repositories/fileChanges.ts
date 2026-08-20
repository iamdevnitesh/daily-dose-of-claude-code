import { getDb, newId } from '../client';
import { nowIso } from '../../time';

export type FileOperation = 'created' | 'modified' | 'deleted';

export interface FileChangeRow {
  id: string;
  session_id: string | null;
  turn_id: string | null;
  prompt_id: string | null;
  file_path: string;
  operation: FileOperation;
  timestamp: string;
}

export function recordFileChange(input: {
  session_id?: string | null;
  turn_id?: string | null;
  prompt_id?: string | null;
  file_path: string;
  operation: FileOperation;
}): FileChangeRow {
  const db = getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO file_changes (id, session_id, turn_id, prompt_id, file_path, operation, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.session_id ?? null,
    input.turn_id ?? null,
    input.prompt_id ?? null,
    input.file_path,
    input.operation,
    nowIso()
  );
  return db.prepare('SELECT * FROM file_changes WHERE id = ?').get(id) as FileChangeRow;
}

export function listFileChangesForTurn(turn_id: string): FileChangeRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM file_changes WHERE turn_id = ? ORDER BY timestamp ASC')
    .all(turn_id) as FileChangeRow[];
}

export function dedupedFilesForTurn(turn_id: string): string[] {
  const rows = listFileChangesForTurn(turn_id);
  return Array.from(new Set(rows.map((r) => r.file_path)));
}
