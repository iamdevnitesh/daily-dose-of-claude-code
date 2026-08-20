import { getDb, newId } from '../client';
import { nowIso, localDayKey } from '../../time';
import { redactText } from '../../redaction';

export interface TurnRow {
  id: string;
  session_id: string;
  claude_session_id: string | null;
  prompt_id: string | null;
  started_at: string;
  ended_at: string | null;
  user_prompt: string | null;
  assistant_response: string | null;
  title: string | null;
  summary: string | null;
  status: string;
  project_name: string | null;
  git_branch: string | null;
  cwd: string | null;
  files_modified_json: string | null;
  commands_run_json: string | null;
  tool_failures: number;
  created_at: string;
  updated_at: string;
}

export function startTurn(input: {
  session_id: string;
  claude_session_id?: string | null;
  prompt_id?: string | null;
  user_prompt: string;
  project_name?: string | null;
  git_branch?: string | null;
  cwd?: string | null;
}): TurnRow {
  const db = getDb();
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO turns
      (id, session_id, claude_session_id, prompt_id, started_at, user_prompt, status, project_name, git_branch, cwd, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.session_id,
    input.claude_session_id ?? null,
    input.prompt_id ?? null,
    now,
    redactText(input.user_prompt),
    input.project_name ?? null,
    input.git_branch ?? null,
    input.cwd ?? null,
    now,
    now
  );
  return db.prepare('SELECT * FROM turns WHERE id = ?').get(id) as TurnRow;
}

export function findActiveTurn(session_id: string, prompt_id?: string | null): TurnRow | null {
  const db = getDb();
  if (prompt_id) {
    const row = db
      .prepare(
        `SELECT * FROM turns WHERE session_id = ? AND prompt_id = ? ORDER BY started_at DESC LIMIT 1`
      )
      .get(session_id, prompt_id) as TurnRow | undefined;
    if (row) return row;
  }
  const row = db
    .prepare(
      `SELECT * FROM turns WHERE session_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`
    )
    .get(session_id) as TurnRow | undefined;
  return row ?? null;
}

export function findLatestTurn(session_id: string): TurnRow | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY started_at DESC LIMIT 1')
    .get(session_id) as TurnRow | undefined;
  return row ?? null;
}

export function finalizeTurn(id: string, patch: {
  assistant_response?: string | null;
  title?: string | null;
  summary?: string | null;
  status?: string;
  ended_at?: string | null;
  files_modified?: string[];
  commands_run?: string[];
  tool_failures?: number;
}): TurnRow {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `UPDATE turns SET
      assistant_response = COALESCE(?, assistant_response),
      title = COALESCE(?, title),
      summary = COALESCE(?, summary),
      status = COALESCE(?, status),
      ended_at = COALESCE(?, ended_at, ?),
      files_modified_json = COALESCE(?, files_modified_json),
      commands_run_json = COALESCE(?, commands_run_json),
      tool_failures = COALESCE(?, tool_failures),
      updated_at = ?
     WHERE id = ?`
  ).run(
    patch.assistant_response ? redactText(patch.assistant_response) : null,
    patch.title ?? null,
    patch.summary ?? null,
    patch.status ?? null,
    patch.ended_at ?? null,
    now,
    patch.files_modified ? JSON.stringify(patch.files_modified) : null,
    patch.commands_run ? JSON.stringify(patch.commands_run) : null,
    typeof patch.tool_failures === 'number' ? patch.tool_failures : null,
    now,
    id
  );
  const row = db.prepare('SELECT * FROM turns WHERE id = ?').get(id) as TurnRow;
  syncTurnFts(row);
  return row;
}

export function syncTurnFts(row: TurnRow): void {
  const db = getDb();
  db.prepare('DELETE FROM turns_fts WHERE rowid IN (SELECT rowid FROM turns_fts WHERE rowid = ?)').run(
    hashToRowid(row.id)
  );
  db.prepare(
    `INSERT INTO turns_fts(rowid, title, summary, user_prompt, assistant_response, project_name)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    hashToRowid(row.id),
    row.title || '',
    row.summary || '',
    row.user_prompt || '',
    row.assistant_response || '',
    row.project_name || ''
  );
}

function hashToRowid(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface DayFilter {
  dayKey: string;
  tz?: string;
}

export function listTurnsForDay({ dayKey }: DayFilter): TurnRow[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM turns ORDER BY started_at ASC').all() as TurnRow[];
  return rows.filter((r) => localDayKey(r.started_at) === dayKey);
}

export function listRecentTurns(project?: string, limit = 20): TurnRow[] {
  const db = getDb();
  if (project) {
    return db
      .prepare(
        `SELECT * FROM turns WHERE project_name = ? AND status IN ('completed','failed','interrupted')
         ORDER BY started_at DESC LIMIT ?`
      )
      .all(project, limit) as TurnRow[];
  }
  return db
    .prepare(
      `SELECT * FROM turns WHERE status IN ('completed','failed','interrupted')
       ORDER BY started_at DESC LIMIT ?`
    )
    .all(limit) as TurnRow[];
}

export function getTurn(id: string): TurnRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM turns WHERE id = ?').get(id) as TurnRow | undefined;
  return row ?? null;
}

export function searchTurns(query: string, opts?: { project?: string; limit?: number }): TurnRow[] {
  const db = getDb();
  const limit = opts?.limit ?? 25;
  const safe = query.replace(/["\s]+/g, ' ').trim();
  if (!safe) return [];
  const rowidResults = db
    .prepare('SELECT rowid FROM turns_fts WHERE turns_fts MATCH ? LIMIT ?')
    .all(safe + '*', limit * 3) as { rowid: number }[];
  const rowids = new Set(rowidResults.map((r) => r.rowid));
  const all = db.prepare('SELECT * FROM turns ORDER BY started_at DESC').all() as TurnRow[];
  const found = all.filter((t) => rowids.has(hashToRowid(t.id)));
  const filtered = opts?.project ? found.filter((t) => t.project_name === opts.project) : found;
  return filtered.slice(0, limit);
}
