import Link from 'next/link';
import type { TurnRow } from '@/lib/db/repositories/turns';
import { formatClock, humanDuration } from '@/lib/time';

export function LeadStory({ turn }: { turn: TurnRow }) {
  const files = turn.files_modified_json ? (JSON.parse(turn.files_modified_json) as string[]).length : 0;
  const commands = turn.commands_run_json ? (JSON.parse(turn.commands_run_json) as string[]).length : 0;
  const duration = humanDuration(turn.started_at, turn.ended_at);

  return (
    <section aria-label="Lead story" className="mb-10">
      <div className="text-[11px] mono uppercase tracking-widest text-claude mb-3">The Big Story</div>
      <Link href={`/activity/${turn.id}`} className="block group">
        <h2 className="serif text-3xl md:text-5xl font-black leading-tight group-hover:underline decoration-2 underline-offset-4">
          {turn.title || 'Untitled work'}
        </h2>
      </Link>
      <div className="mt-3 text-xs mono uppercase tracking-widest text-muted">
        {formatClock(turn.started_at)}
        {turn.project_name ? ` · ${turn.project_name}` : ''}
        {turn.git_branch ? ` · ${turn.git_branch}` : ''}
      </div>
      {turn.summary && (
        <p className="serif text-lg md:text-xl leading-relaxed mt-4 max-w-3xl">{turn.summary}</p>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-xs mono text-muted">
        {duration && <span>{duration}</span>}
        {files > 0 && <span>{files} file{files > 1 ? 's' : ''}</span>}
        {commands > 0 && <span>{commands} command{commands > 1 ? 's' : ''}</span>}
        {turn.tool_failures > 0 && (
          <span className="text-claude">{turn.tool_failures} failure{turn.tool_failures > 1 ? 's' : ''}</span>
        )}
      </div>
    </section>
  );
}
