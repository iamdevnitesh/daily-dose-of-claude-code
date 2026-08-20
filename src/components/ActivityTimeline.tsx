import Link from 'next/link';
import type { TurnRow } from '@/lib/db/repositories/turns';
import { formatClock, humanDuration } from '@/lib/time';

export function ActivityTimeline({ turns, leadId }: { turns: TurnRow[]; leadId?: string | null }) {
  const others = leadId ? turns.filter((t) => t.id !== leadId) : turns;
  if (others.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="text-[11px] mono uppercase tracking-widest text-claude mb-4">Today In Code</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {others.map((t) => {
          const files = t.files_modified_json ? (JSON.parse(t.files_modified_json) as string[]).length : 0;
          const commands = t.commands_run_json ? (JSON.parse(t.commands_run_json) as string[]).length : 0;
          const duration = humanDuration(t.started_at, t.ended_at);
          return (
            <article key={t.id} className="pb-6 hairline-bottom">
              <div className="text-[11px] mono uppercase tracking-widest text-muted mb-1">
                {formatClock(t.started_at)}
                {t.project_name ? ` · ${t.project_name}` : ''}
              </div>
              <Link href={`/activity/${t.id}`} className="block group">
                <h3 className="serif text-xl md:text-2xl font-bold leading-tight group-hover:underline decoration-2 underline-offset-4">
                  {t.title || 'Untitled work'}
                </h3>
              </Link>
              {t.summary && <p className="serif text-base leading-relaxed mt-2 text-ink/90">{t.summary}</p>}
              <div className="flex flex-wrap gap-x-4 mt-2 text-[11px] mono text-muted">
                {duration && <span>{duration}</span>}
                {files > 0 && <span>{files} file{files > 1 ? 's' : ''}</span>}
                {commands > 0 && <span>{commands} cmd{commands > 1 ? 's' : ''}</span>}
                {t.tool_failures > 0 && (
                  <span className="text-claude">{t.tool_failures} failure{t.tool_failures > 1 ? 's' : ''}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
