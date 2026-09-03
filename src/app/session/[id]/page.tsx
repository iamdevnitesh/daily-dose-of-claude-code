import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SessionTaskList } from '@/components/SessionTaskList';
import { ResumeButton } from '@/components/ResumeButton';
import { getSessionByInternalId } from '@/lib/db/repositories/sessions';
import { listTodos } from '@/lib/db/repositories/todos';
import { summarizeSession } from '@/lib/session/summarize';
import { extractSessionTasks } from '@/lib/session/tasks';
import { getDb } from '@/lib/db/client';
import { formatClock, humanDuration, localDayKey, prettyDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: { id: string } }) {
  const session = getSessionByInternalId(params.id);
  if (!session) return notFound();

  // Lazy generate title/summary the first time this page is visited
  let title = session.session_title;
  let summary = session.session_summary;
  let source = session.summary_source;
  if (!title || !summary) {
    const gen = await summarizeSession(session.id);
    if (gen) {
      title = gen.title;
      summary = gen.summary;
      source = gen.source;
    }
  }

  const tasks = extractSessionTasks(session.id);

  const db = getDb();
  const turns = db
    .prepare(
      `SELECT id, prompt_id, started_at, ended_at, title, summary, status, user_prompt,
              files_modified_json, commands_run_json, tool_failures
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

  const files = new Set<string>();
  let commands = 0;
  for (const t of turns) {
    if (t.files_modified_json) {
      try { for (const f of JSON.parse(t.files_modified_json) as string[]) files.add(f); } catch { /* ignore */ }
    }
    if (t.commands_run_json) {
      try { commands += (JSON.parse(t.commands_run_json) as string[]).length; } catch { /* ignore */ }
    }
  }
  const duration = humanDuration(session.started_at, session.ended_at);
  const dayKey = localDayKey(session.started_at);
  const openTodos = listTodos({ status: 'active', project: session.project_name || undefined, limit: 25 });

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3 text-xs mono uppercase tracking-widest text-muted">
          <Link href={`/day/${dayKey}`} className="hover:text-ink">← {prettyDate(dayKey)}</Link>
          <span>·</span>
          <Link href="/todos" className="hover:text-ink">Todos</Link>
          <Link href="/search" className="hover:text-ink">Search</Link>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 md:gap-10">
        <main className="md:col-span-2">
          <div className="text-xs mono uppercase tracking-widest text-claude mb-2">
            {formatClock(session.started_at)}
            {session.ended_at ? `–${formatClock(session.ended_at)}` : ''}
            {session.project_name ? ` · ${session.project_name}` : ''}
            {session.git_branch ? ` · ${session.git_branch}` : ''}
            {source ? ` · ${source}` : ''}
          </div>
          <h1 className="serif text-4xl md:text-5xl font-black leading-tight">{title || 'Claude Code session'}</h1>
          {summary && <p className="serif text-lg md:text-xl leading-relaxed mt-4 text-ink/90">{summary}</p>}

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-xs mono uppercase tracking-widest text-muted">
            <span>Status: {session.ended_at ? 'ended' : 'active'}</span>
            {duration && <span>Duration: {duration}</span>}
            <span>Turns: {turns.length}</span>
            <span>Files: {files.size}</span>
            <span>Commands: {commands}</span>
          </div>

          <section className="mt-10">
            <div className="text-[11px] mono uppercase tracking-widest text-claude mb-4">Task Ledger</div>
            <SessionTaskList tasks={tasks} />
          </section>

          <section className="mt-10">
            <div className="text-[11px] mono uppercase tracking-widest text-claude mb-4">Turn-by-turn</div>
            <ol className="space-y-3">
              {turns.map((t) => (
                <li key={t.id} className="rule border rounded-lg p-3">
                  <div className="flex items-baseline justify-between text-[11px] mono uppercase tracking-widest text-muted">
                    <span>{formatClock(t.started_at)}</span>
                    <Link href={`/activity/${t.id}`} className="hover:text-ink">details →</Link>
                  </div>
                  <div className="serif text-base font-bold mt-1">{t.title || 'Untitled turn'}</div>
                  {t.summary && <div className="text-sm text-ink/85 mt-1">{t.summary}</div>}
                </li>
              ))}
              {turns.length === 0 && <li className="text-sm text-muted italic">No turns captured.</li>}
            </ol>
          </section>
        </main>

        <aside className="md:col-span-1 space-y-6 md:mt-6 md:sticky md:top-6 md:self-start">
          <ResumeButton sessionId={session.id} />

          <div className="rule border rounded-lg p-5">
            <div className="text-[11px] mono uppercase tracking-widest text-muted mb-3">
              Open TODOs{session.project_name ? ` · ${session.project_name}` : ''}
            </div>
            {openTodos.length === 0 ? (
              <p className="text-sm text-muted italic">No open TODOs for this project.</p>
            ) : (
              <ul className="space-y-2">
                {openTodos.map((t) => (
                  <li key={t.id} className="text-sm">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${t.priority === 'high' ? 'bg-claude' : 'bg-muted/60'}`} />
                    {t.title}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Link href="/todos" className="text-[11px] mono uppercase tracking-widest text-claude hover:underline">
                Manage all TODOs →
              </Link>
            </div>
          </div>

          <div className="rule border rounded-lg p-5 text-xs mono text-muted space-y-1 break-all">
            <div className="uppercase tracking-widest">Session</div>
            <div>id: {session.claude_session_id || session.id}</div>
            {session.cwd && <div>cwd: {session.cwd}</div>}
            {session.git_root && <div>git: {session.git_root}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
