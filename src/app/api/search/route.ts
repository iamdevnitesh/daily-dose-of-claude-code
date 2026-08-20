import { NextResponse } from 'next/server';
import { searchTurns } from '@/lib/db/repositories/turns';
import { searchTodos } from '@/lib/db/repositories/todos';
import { localDayKey } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const project = url.searchParams.get('project') || undefined;
  const limit = Number(url.searchParams.get('limit') || 25);
  if (!q.trim()) return NextResponse.json({ activities: [], todos: [] });
  const turns = searchTurns(q, { project, limit }).map((t) => ({
    id: t.id,
    day: localDayKey(t.started_at),
    project: t.project_name,
    title: t.title,
    summary: t.summary
  }));
  const todos = searchTodos(q, limit).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    project: t.project_name
  }));
  return NextResponse.json({ activities: turns, todos });
}
