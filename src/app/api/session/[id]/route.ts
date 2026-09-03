import { NextResponse } from 'next/server';
import { getSessionByInternalId } from '@/lib/db/repositories/sessions';
import { getDb } from '@/lib/db/client';
import { extractSessionTasks } from '@/lib/session/tasks';
import { summarizeSession } from '@/lib/session/summarize';
import { listTodos } from '@/lib/db/repositories/todos';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = getSessionByInternalId(params.id);
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Lazy summarize on first render
  let summaryTitle = session.session_title;
  let summaryText = session.session_summary;
  let summarySource = session.summary_source;
  if (!summaryTitle || !summaryText) {
    const gen = await summarizeSession(session.id);
    if (gen) {
      summaryTitle = gen.title;
      summaryText = gen.summary;
      summarySource = gen.source;
    }
  }

  const tasks = extractSessionTasks(session.id);

  const db = getDb();
  const turns = db
    .prepare(
      `SELECT id, prompt_id, started_at, ended_at, title, summary, status, user_prompt, files_modified_json, commands_run_json, tool_failures
       FROM turns WHERE session_id = ? ORDER BY started_at ASC`
    )
    .all(session.id) as Array<{
    id: string;
    prompt_id: string | null;
    started_at: string;
    ended_at: string | null;
    title: string | null;
    summary: string | null;
    status: string;
    user_prompt: string | null;
    files_modified_json: string | null;
    commands_run_json: string | null;
    tool_failures: number | null;
  }>;

  const filesSet = new Set<string>();
  let commandCount = 0;
  let toolFailures = 0;
  for (const t of turns) {
    if (t.files_modified_json) {
      try {
        for (const f of JSON.parse(t.files_modified_json) as string[]) filesSet.add(f);
      } catch { /* ignore */ }
    }
    if (t.commands_run_json) {
      try {
        commandCount += (JSON.parse(t.commands_run_json) as string[]).length;
      } catch { /* ignore */ }
    }
    if (typeof t.tool_failures === 'number') toolFailures += t.tool_failures;
  }

  const openTodos = listTodos({ status: 'active', project: session.project_name || undefined, limit: 50 });

  return NextResponse.json({
    session,
    summary: {
      title: summaryTitle,
      body: summaryText,
      source: summarySource
    },
    tasks,
    turns,
    stats: {
      turns: turns.length,
      files: filesSet.size,
      commands: commandCount,
      toolFailures
    },
    openTodos
  });
}
