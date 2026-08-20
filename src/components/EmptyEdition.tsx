import { prettyDate } from '@/lib/time';

export function EmptyEdition({ dayKey }: { dayKey: string }) {
  return (
    <section className="text-center py-14">
      <div className="text-xs mono uppercase tracking-widest text-claude mb-2">No Edition Published</div>
      <h2 className="serif text-3xl font-black leading-tight max-w-xl mx-auto">
        No Claude Code activity was recorded on {prettyDate(dayKey)}.
      </h2>
      <p className="serif text-lg text-muted mt-3 max-w-lg mx-auto">
        Try starting a Claude Code session in any project — the day&apos;s edition writes itself.
      </p>
    </section>
  );
}
