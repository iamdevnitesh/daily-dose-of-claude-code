import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTurn } from '@/lib/db/repositories/turns';
import { listToolEventsForTurn } from '@/lib/db/repositories/toolEvents';
import { listFileChangesForTurn } from '@/lib/db/repositories/fileChanges';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatClock, humanDuration, localDayKey, prettyDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default function ActivityPage({ params }: { params: { id: string } }) {
  const turn = getTurn(params.id);
  if (!turn) return notFound();
  const events = listToolEventsForTurn(turn.id);
  const files = listFileChangesForTurn(turn.id);
  const duration = humanDuration(turn.started_at, turn.ended_at);
  const dayKey = localDayKey(turn.started_at);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <Link href={`/day/${dayKey}`} className="text-xs mono uppercase tracking-widest text-muted hover:text-ink">
          ← {prettyDate(dayKey)}
        </Link>
        <ThemeToggle />
      </div>
      <div className="text-xs mono uppercase tracking-widest text-claude mb-2">
        {formatClock(turn.started_at)}
        {turn.project_name ? ` · ${turn.project_name}` : ''}
        {turn.git_branch ? ` · ${turn.git_branch}` : ''}
      </div>
      <h1 className="serif text-4xl md:text-5xl font-black leading-tight">{turn.title || 'Untitled activity'}</h1>
      {turn.summary && <p className="serif text-lg md:text-xl leading-relaxed mt-4">{turn.summary}</p>}

      <div className="mt-4 flex flex-wrap gap-x-6 text-xs mono uppercase tracking-widest text-muted">
        <span>Status: {turn.status}</span>
        {duration && <span>Duration: {duration}</span>}
        <span>Files: {files.length}</span>
        <span>Tool events: {events.length}</span>
        {turn.tool_failures > 0 && <span className="text-claude">Failures: {turn.tool_failures}</span>}
      </div>

      {turn.user_prompt && (
        <section className="mt-8">
          <h2 className="text-xs mono uppercase tracking-widest text-muted mb-2">Prompt</h2>
          <pre className="whitespace-pre-wrap serif text-base leading-relaxed border rule rounded-lg p-4 bg-card/40">
            {turn.user_prompt}
          </pre>
        </section>
      )}

      {turn.assistant_response && (
        <section className="mt-6">
          <h2 className="text-xs mono uppercase tracking-widest text-muted mb-2">Claude&apos;s Response</h2>
          <pre className="whitespace-pre-wrap serif text-base leading-relaxed border rule rounded-lg p-4 bg-card/40">
            {turn.assistant_response}
          </pre>
        </section>
      )}

      {files.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs mono uppercase tracking-widest text-muted mb-2">Files Modified</h2>
          <ul className="mono text-sm space-y-1">
            {files.map((f) => (
              <li key={f.id}>
                <span className="text-muted mr-2">{f.operation}</span>
                {f.file_path}
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs mono uppercase tracking-widest text-muted mb-2">Tool Activity</h2>
          <ol className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="border rule rounded-md px-3 py-2">
                <div className="flex items-baseline justify-between text-xs mono">
                  <span>
                    {e.tool_name}
                    {e.event_type === 'failure' ? ' · failed' : ''}
                  </span>
                  <span className="text-muted">{formatClock(e.created_at)}</span>
                </div>
                <div className="text-sm mt-1">{e.input_summary}</div>
                {e.output_summary && <div className="text-xs text-muted mt-1 mono">{e.output_summary}</div>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
