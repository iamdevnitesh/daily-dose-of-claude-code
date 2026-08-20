import { getDb, newId } from '../client';
import { nowIso } from '../../time';

export interface SessionRow {
  id: string;
  claude_session_id: string | null;
  project_name: string | null;
  cwd: string | null;
  git_root: string | null;
  git_branch: string | null;
  started_at: string;
  ended_at: string | null;
  source: string | null;
  transcript_path: string | null;
  created_at: string;
  updated_at: string;
}

export function upsertSession(input: {
  claude_session_id?: string | null;
  project_name?: string | null;
  cwd?: string | null;
  git_root?: string | null;
  git_branch?: string | null;
  source?: string | null;
  transcript_path?: string | null;
}): SessionRow {
  const db = getDb();
  const now = nowIso();
  const existing = input.claude_session_id
    ? (db
        .prepare('SELECT * FROM sessions WHERE claude_session_id = ?')
        .get(input.claude_session_id) as SessionRow | undefined)
    : undefined;

  if (existing) {
    db.prepare(
      `UPDATE sessions SET
        project_name = COALESCE(?, project_name),
        cwd = COALESCE(?, cwd),
        git_root = COALESCE(?, git_root),
        git_branch = COALESCE(?, git_branch),
        source = COALESCE(?, source),
        transcript_path = COALESCE(?, transcript_path),
        updated_at = ?
       WHERE id = ?`
    ).run(
      input.project_name ?? null,
      input.cwd ?? null,
      input.git_root ?? null,
      input.git_branch ?? null,
      input.source ?? null,
      input.transcript_path ?? null,
      now,
      existing.id
    );
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(existing.id) as SessionRow;
  }

  const id = newId();
  db.prepare(
    `INSERT INTO sessions
      (id, claude_session_id, project_name, cwd, git_root, git_branch, started_at, source, transcript_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.claude_session_id ?? null,
    input.project_name ?? null,
    input.cwd ?? null,
    input.git_root ?? null,
    input.git_branch ?? null,
    now,
    input.source ?? null,
    input.transcript_path ?? null,
    now,
    now
  );
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow;
}

export function endSession(claude_session_id: string): void {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    'UPDATE sessions SET ended_at = COALESCE(ended_at, ?), updated_at = ? WHERE claude_session_id = ?'
  ).run(now, now, claude_session_id);
  db.prepare(
    `UPDATE turns SET status = 'interrupted', ended_at = COALESCE(ended_at, ?), updated_at = ?
     WHERE claude_session_id = ? AND status = 'active'`
  ).run(now, now, claude_session_id);
}

export function findSessionByClaudeId(claude_session_id: string): SessionRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE claude_session_id = ?').get(claude_session_id) as
    | SessionRow
    | undefined;
  return row ?? null;
}
