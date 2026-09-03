import Link from 'next/link';
import type { SessionCard as SessionCardT } from '@/lib/db/repositories/day';
import { formatClock, humanDuration } from '@/lib/time';

export function SessionCard({ card, featured = false }: { card: SessionCardT; featured?: boolean }) {
  const duration = humanDuration(card.startedAt, card.endedAt);
  const timeRange = `${formatClock(card.startedAt)}${card.endedAt ? '–' + formatClock(card.endedAt) : ''}`;
  const badge = card.summarySource === 'haiku' ? 'HAIKU' : card.summary ? 'AUTO' : null;

  return (
    <article className={`rule border rounded-lg p-5 ${featured ? 'md:p-7' : ''} bg-card/30 hover:bg-card/60 transition`}>
      <div className="flex items-baseline justify-between mb-2 text-[11px] mono uppercase tracking-widest text-muted">
        <span>
          {timeRange}
          {card.session.project_name ? ` · ${card.session.project_name}` : ''}
          {card.session.git_branch ? ` · ${card.session.git_branch}` : ''}
        </span>
        {badge && <span className="text-claude">{badge}</span>}
      </div>
      <Link href={`/session/${card.session.id}`} className="block group">
        <h3
          className={`serif font-black leading-tight group-hover:underline decoration-2 underline-offset-4 ${
            featured ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'
          }`}
        >
          {card.title || 'Claude Code session'}
        </h3>
      </Link>
      {card.summary && (
        <p className={`serif leading-relaxed mt-3 text-ink/90 ${featured ? 'text-lg' : 'text-base'}`}>
          {card.summary}
        </p>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs mono uppercase tracking-widest text-muted">
        {duration && <span>{duration}</span>}
        <span>
          {card.taskCount} task{card.taskCount === 1 ? '' : 's'}
        </span>
        {card.filesTouched > 0 && (
          <span>
            {card.filesTouched} file{card.filesTouched === 1 ? '' : 's'}
          </span>
        )}
        {card.commandsRun > 0 && (
          <span>
            {card.commandsRun} cmd{card.commandsRun === 1 ? '' : 's'}
          </span>
        )}
        {card.toolFailures > 0 && (
          <span className="text-claude">
            {card.toolFailures} failure{card.toolFailures > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </article>
  );
}
