import { getDb } from '../client';
import { localDayKey } from '../../time';
import type { TurnRow } from './turns';
import type { TodoRow } from './todos';
import type { ToolEventRow } from './toolEvents';
import type { FileChangeRow } from './fileChanges';
import { listTurnsForDay } from './turns';
import { todosCreatedOnDay, todosCompletedOnDay, listTodos } from './todos';

export interface DayView {
  dayKey: string;
  turns: TurnRow[];
  leadStoryId: string | null;
  projects: string[];
  todosCreated: TodoRow[];
  todosCompleted: TodoRow[];
  openTodos: TodoRow[];
  stats: {
    turnCount: number;
    completedTurnCount: number;
    projectCount: number;
    filesTouched: number;
    commandsRun: number;
    toolFailures: number;
    todosCreated: number;
    todosCompleted: number;
    sessionCount: number;
  };
  summary: string;
}

function scoreTurn(t: TurnRow): number {
  const durationMs =
    t.started_at && t.ended_at ? new Date(t.ended_at).getTime() - new Date(t.started_at).getTime() : 0;
  const files = t.files_modified_json ? (JSON.parse(t.files_modified_json) as string[]).length : 0;
  const commands = t.commands_run_json ? (JSON.parse(t.commands_run_json) as string[]).length : 0;
  return Math.min(durationMs / 60000, 120) + files * 8 + commands * 3;
}

export function buildDayView(dayKey: string): DayView {
  const db = getDb();
  const turns = listTurnsForDay({ dayKey });
  const todosCreated = todosCreatedOnDay(dayKey);
  const todosCompleted = todosCompletedOnDay(dayKey);
  const openTodos = listTodos({ status: 'active', limit: 200 });

  const projects = Array.from(new Set(turns.map((t) => t.project_name).filter(Boolean))) as string[];

  const sessionIds = new Set(turns.map((t) => t.session_id));

  let filesTouched = 0;
  let commandsRun = 0;
  let toolFailures = 0;
  for (const t of turns) {
    if (t.files_modified_json) filesTouched += (JSON.parse(t.files_modified_json) as string[]).length;
    if (t.commands_run_json) commandsRun += (JSON.parse(t.commands_run_json) as string[]).length;
    if (typeof t.tool_failures === 'number') toolFailures += t.tool_failures;
  }
  const completedTurnCount = turns.filter((t) => t.status === 'completed').length;

  let leadStoryId: string | null = null;
  let best = -1;
  for (const t of turns) {
    const s = scoreTurn(t);
    if (s > best) {
      best = s;
      leadStoryId = t.id;
    }
  }

  const summary = buildSummary({
    turnCount: turns.length,
    completedTurnCount,
    projects,
    filesTouched,
    commandsRun,
    toolFailures,
    todosCreated: todosCreated.length,
    todosCompleted: todosCompleted.length
  });

  void db;
  return {
    dayKey,
    turns,
    leadStoryId,
    projects,
    todosCreated,
    todosCompleted,
    openTodos,
    stats: {
      turnCount: turns.length,
      completedTurnCount,
      projectCount: projects.length,
      filesTouched,
      commandsRun,
      toolFailures,
      todosCreated: todosCreated.length,
      todosCompleted: todosCompleted.length,
      sessionCount: sessionIds.size
    },
    summary
  };
}

function buildSummary(input: {
  turnCount: number;
  completedTurnCount: number;
  projects: string[];
  filesTouched: number;
  commandsRun: number;
  toolFailures: number;
  todosCreated: number;
  todosCompleted: number;
}): string {
  if (input.turnCount === 0) return '';
  const parts: string[] = [];
  const projectClause = input.projects.length
    ? `across ${input.projects.length} project${input.projects.length > 1 ? 's' : ''}`
    : '';
  const done = input.completedTurnCount || input.turnCount;
  const stats: string[] = [];
  if (input.filesTouched)
    stats.push(`modifying ${input.filesTouched} file${input.filesTouched > 1 ? 's' : ''}`);
  if (input.commandsRun)
    stats.push(`running ${input.commandsRun} command${input.commandsRun > 1 ? 's' : ''}`);
  if (input.todosCompleted)
    stats.push(`closing ${input.todosCompleted} TODO${input.todosCompleted > 1 ? 's' : ''}`);
  const statsClause = stats.length ? ` — ${stats.join(', ')}` : '';
  parts.push(
    `Today you worked ${projectClause}, completing ${done} Claude-assisted task${done > 1 ? 's' : ''}${statsClause}.`
  );
  if (input.projects.length) {
    parts.push(`Most activity centered around ${input.projects.slice(0, 2).join(' and ')}.`);
  }
  return parts.join(' ');
}

export interface RecentActivityItem {
  id: string;
  started_at: string;
  project_name: string | null;
  title: string | null;
  summary: string | null;
  dayKey: string;
}

export function recentActivity(project?: string, limit = 5): RecentActivityItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, started_at, project_name, title, summary FROM turns
       WHERE status IN ('completed','failed') ${project ? 'AND project_name = ?' : ''}
       ORDER BY started_at DESC LIMIT ?`
    )
    .all(...(project ? [project, limit] : [limit])) as Array<{
    id: string;
    started_at: string;
    project_name: string | null;
    title: string | null;
    summary: string | null;
  }>;
  return rows.map((r) => ({ ...r, dayKey: localDayKey(r.started_at) }));
}

export function daysWithActivity(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT started_at FROM turns ORDER BY started_at ASC').all() as {
    started_at: string;
  }[];
  const days = new Set<string>();
  for (const r of rows) days.add(localDayKey(r.started_at));
  return Array.from(days);
}
