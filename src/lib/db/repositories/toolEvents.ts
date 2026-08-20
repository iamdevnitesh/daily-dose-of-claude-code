import { getDb, newId } from '../client';
import { nowIso } from '../../time';

export interface ToolEventRow {
  id: string;
  session_id: string | null;
  turn_id: string | null;
  prompt_id: string | null;
  tool_use_id: string | null;
  tool_name: string | null;
  event_type: string;
  input_summary: string | null;
  output_summary: string | null;
  duration_ms: number | null;
  created_at: string;
}

export function recordToolEvent(input: {
  session_id?: string | null;
  turn_id?: string | null;
  prompt_id?: string | null;
  tool_use_id?: string | null;
  tool_name?: string | null;
  event_type?: 'success' | 'failure';
  input_summary?: string | null;
  output_summary?: string | null;
  duration_ms?: number | null;
}): ToolEventRow {
  const db = getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO tool_events
      (id, session_id, turn_id, prompt_id, tool_use_id, tool_name, event_type, input_summary, output_summary, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.session_id ?? null,
    input.turn_id ?? null,
    input.prompt_id ?? null,
    input.tool_use_id ?? null,
    input.tool_name ?? null,
    input.event_type ?? 'success',
    input.input_summary ?? null,
    input.output_summary ?? null,
    input.duration_ms ?? null,
    nowIso()
  );
  return db.prepare('SELECT * FROM tool_events WHERE id = ?').get(id) as ToolEventRow;
}

export function listToolEventsForTurn(turn_id: string): ToolEventRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM tool_events WHERE turn_id = ? ORDER BY created_at ASC')
    .all(turn_id) as ToolEventRow[];
}

export function countFailuresForTurn(turn_id: string): number {
  const db = getDb();
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM tool_events WHERE turn_id = ? AND event_type = 'failure'`)
    .get(turn_id) as { c: number };
  return row?.c ?? 0;
}
