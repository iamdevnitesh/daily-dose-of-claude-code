import { getDb } from '../db/client';

export interface SessionTaskItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  first_seen_at: string;
  last_seen_at: string;
  activeForm?: string;
}

interface RawTodoWrite {
  ts: string;
  input_summary: string | null;
  output_summary: string | null;
}

// Best-effort parse of TodoWrite payload. Claude Code's TodoWrite sends
// { todos: [{content, status, activeForm}, ...] }. Because we only persist
// input_summary (a short description), we also parse output_summary and
// try to extract todo array from either. When we cannot recover structured
// todos, we return null and the UI falls back to executed-tools ordering.
function tryParseTodoArray(text: string | null): Array<{ content: string; status: string; activeForm?: string }> | null {
  if (!text) return null;
  const arr = text.match(/\[[\s\S]*\]/);
  if (!arr) return null;
  try {
    const parsed = JSON.parse(arr[0]);
    if (!Array.isArray(parsed)) return null;
    const cleaned: Array<{ content: string; status: string; activeForm?: string }> = [];
    for (const item of parsed) {
      if (!item) continue;
      const content = String(item.content || item.title || item.text || '').trim();
      if (!content) continue;
      const status = String(item.status || 'pending').toLowerCase();
      const entry: { content: string; status: string; activeForm?: string } = { content, status };
      if (item.activeForm) entry.activeForm = String(item.activeForm);
      cleaned.push(entry);
    }
    return cleaned.length ? cleaned : null;
  } catch {
    return null;
  }
}

export function extractSessionTasks(sessionId: string): SessionTaskItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT created_at as ts, input_summary, output_summary FROM tool_events
       WHERE session_id = ? AND LOWER(tool_name) = 'todowrite'
       ORDER BY created_at ASC`
    )
    .all(sessionId) as RawTodoWrite[];

  if (rows.length === 0) {
    return synthesizeTasksFromTurns(sessionId);
  }

  const byContent = new Map<string, SessionTaskItem>();
  const order: string[] = [];

  for (const row of rows) {
    const list = tryParseTodoArray(row.input_summary) || tryParseTodoArray(row.output_summary);
    if (!list) continue;
    for (const item of list) {
      const key = item.content.toLowerCase().slice(0, 200);
      if (!byContent.has(key)) {
        byContent.set(key, {
          content: item.content,
          status: normalizeStatus(item.status),
          first_seen_at: row.ts,
          last_seen_at: row.ts,
          activeForm: item.activeForm
        });
        order.push(key);
      } else {
        const existing = byContent.get(key)!;
        existing.status = normalizeStatus(item.status);
        existing.last_seen_at = row.ts;
        if (item.activeForm && !existing.activeForm) existing.activeForm = item.activeForm;
      }
    }
  }

  const tasks = order.map((k) => byContent.get(k)!);
  tasks.sort((a, b) => statusRank(a.status) - statusRank(b.status));
  return tasks;
}

function statusRank(status: SessionTaskItem['status']): number {
  if (status === 'completed') return 0;
  if (status === 'in_progress') return 1;
  return 2;
}

function normalizeStatus(raw: string): SessionTaskItem['status'] {
  const s = raw.toLowerCase();
  if (s === 'completed' || s === 'done' || s === 'closed') return 'completed';
  if (s === 'in_progress' || s === 'active' || s === 'working') return 'in_progress';
  return 'pending';
}

// Fallback: if there are no TodoWrite events, synthesize a task list from
// the session's turns (each turn = one task Claude worked on).
function synthesizeTasksFromTurns(sessionId: string): SessionTaskItem[] {
  const db = getDb();
  const turns = db
    .prepare(
      `SELECT id, title, user_prompt, started_at, status FROM turns
       WHERE session_id = ? ORDER BY started_at ASC`
    )
    .all(sessionId) as Array<{
    id: string;
    title: string | null;
    user_prompt: string | null;
    started_at: string;
    status: string;
  }>;

  return turns
    .map((t) => {
      const content = t.title || (t.user_prompt ? t.user_prompt.split(/\n/)[0].slice(0, 120) : null);
      if (!content) return null;
      const status: SessionTaskItem['status'] =
        t.status === 'completed' ? 'completed' : t.status === 'active' ? 'in_progress' : 'pending';
      return {
        content,
        status,
        first_seen_at: t.started_at,
        last_seen_at: t.started_at
      } satisfies SessionTaskItem;
    })
    .filter((x): x is SessionTaskItem => x !== null);
}
