import { getDb, newId } from '../client';
import { nowIso, localDayKey } from '../../time';
import type { TodoInputT, TodoPatchT } from '../../schemas';

export interface TodoRow {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  due_at: string | null;
  source: 'claude' | 'ui';
  source_session_id: string | null;
  source_prompt_id: string | null;
  project_name: string | null;
  tags_json: string | null;
}

function hashToRowid(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function syncFts(row: TodoRow): void {
  const db = getDb();
  db.prepare('DELETE FROM todos_fts WHERE rowid = ?').run(hashToRowid(row.id));
  db.prepare('INSERT INTO todos_fts(rowid, title, description, project_name) VALUES (?, ?, ?, ?)').run(
    hashToRowid(row.id),
    row.title,
    row.description || '',
    row.project_name || ''
  );
}

export function createTodo(input: TodoInputT): TodoRow {
  const db = getDb();
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO todos
      (id, title, description, status, priority, created_at, updated_at, due_at, source, source_session_id, source_prompt_id, project_name, tags_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title,
    input.description ?? null,
    input.status ?? 'open',
    input.priority ?? 'medium',
    now,
    now,
    input.due_at ?? null,
    input.source ?? 'ui',
    input.source_session_id ?? null,
    input.source_prompt_id ?? null,
    input.project_name ?? null,
    input.tags && input.tags.length ? JSON.stringify(input.tags) : null
  );
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow;
  syncFts(row);
  return row;
}

export function updateTodo(id: string, patch: TodoPatchT): TodoRow | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
  if (!existing) return null;
  const now = nowIso();
  const completing = patch.status === 'completed' && existing.status !== 'completed';
  const uncompleting = patch.status && patch.status !== 'completed' && existing.status === 'completed';
  db.prepare(
    `UPDATE todos SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      due_at = COALESCE(?, due_at),
      project_name = COALESCE(?, project_name),
      tags_json = COALESCE(?, tags_json),
      completed_at = CASE
        WHEN ? = 1 THEN ?
        WHEN ? = 1 THEN NULL
        ELSE completed_at
      END,
      updated_at = ?
     WHERE id = ?`
  ).run(
    patch.title ?? null,
    patch.description ?? null,
    patch.status ?? null,
    patch.priority ?? null,
    patch.due_at ?? null,
    patch.project_name ?? null,
    patch.tags && patch.tags.length ? JSON.stringify(patch.tags) : null,
    completing ? 1 : 0,
    now,
    uncompleting ? 1 : 0,
    now,
    id
  );
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow;
  syncFts(row);
  return row;
}

export function deleteTodo(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  db.prepare('DELETE FROM todos_fts WHERE rowid = ?').run(hashToRowid(id));
  return result.changes > 0;
}

export function getTodo(id: string): TodoRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
  return row ?? null;
}

export interface ListTodosFilter {
  status?: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'active';
  project?: string;
  limit?: number;
}

export function listTodos(filter?: ListTodosFilter): TodoRow[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: any[] = [];
  if (filter?.status && filter.status !== 'active') {
    clauses.push('status = ?');
    params.push(filter.status);
  } else if (filter?.status === 'active') {
    clauses.push(`status IN ('open','in_progress')`);
  }
  if (filter?.project) {
    clauses.push('project_name = ?');
    params.push(filter.project);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = filter?.limit ?? 500;
  const sql = `SELECT * FROM todos ${where} ORDER BY
    CASE status WHEN 'in_progress' THEN 0 WHEN 'open' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
    CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
    created_at DESC
    LIMIT ?`;
  return db.prepare(sql).all(...params, limit) as TodoRow[];
}

export function todosCreatedOnDay(dayKey: string): TodoRow[] {
  const rows = getDb().prepare('SELECT * FROM todos ORDER BY created_at ASC').all() as TodoRow[];
  return rows.filter((r) => localDayKey(r.created_at) === dayKey);
}

export function todosCompletedOnDay(dayKey: string): TodoRow[] {
  const rows = getDb()
    .prepare('SELECT * FROM todos WHERE completed_at IS NOT NULL ORDER BY completed_at ASC')
    .all() as TodoRow[];
  return rows.filter((r) => r.completed_at && localDayKey(r.completed_at) === dayKey);
}

export function searchTodos(query: string, limit = 25): TodoRow[] {
  const db = getDb();
  const safe = query.replace(/["\s]+/g, ' ').trim();
  if (!safe) return [];
  const rowids = new Set(
    (db
      .prepare('SELECT rowid FROM todos_fts WHERE todos_fts MATCH ? LIMIT ?')
      .all(safe + '*', limit * 3) as { rowid: number }[]).map((r) => r.rowid)
  );
  const all = db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all() as TodoRow[];
  return all.filter((t) => rowids.has(hashToRowid(t.id))).slice(0, limit);
}

export function findTodoByTitleLike(query: string, project?: string): TodoRow | null {
  const db = getDb();
  const like = `%${query.trim()}%`;
  if (project) {
    return (
      (db
        .prepare(`SELECT * FROM todos WHERE title LIKE ? AND project_name = ? ORDER BY created_at DESC LIMIT 1`)
        .get(like, project) as TodoRow | undefined) ?? null
    );
  }
  return (
    (db
      .prepare(`SELECT * FROM todos WHERE title LIKE ? ORDER BY created_at DESC LIMIT 1`)
      .get(like) as TodoRow | undefined) ?? null
  );
}
