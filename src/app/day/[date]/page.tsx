import { buildDayView } from '@/lib/db/repositories/day';
import { Masthead } from '@/components/Masthead';
import { SessionCard } from '@/components/SessionCard';
import { DayStats } from '@/components/DayStats';
import { EmptyEdition } from '@/components/EmptyEdition';
import { DaySummary } from '@/components/DaySummary';
import { EndOfEdition } from '@/components/EndOfEdition';
import { AutoRefresh } from '@/components/AutoRefresh';
import { todayLocal } from '@/lib/time';

export const dynamic = 'force-dynamic';

interface Props {
  params: { date: string };
}

export default function DayPage({ params }: Props) {
  const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayLocal();
  const view = buildDayView(dayKey);
  const lead = view.leadSessionId ? view.sessions.find((s) => s.session.id === view.leadSessionId) : null;
  const others = lead ? view.sessions.filter((s) => s.session.id !== lead.session.id) : view.sessions;
  const isToday = dayKey === todayLocal();

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pb-24">
      <Masthead dayKey={dayKey} />
      {isToday && <AutoRefresh />}

      <div className="grid grid-cols-1 md:grid-cols-3 md:gap-10 mt-2">
        <main className="md:col-span-2 md:col-start-2 md:row-start-1">
          {view.sessions.length === 0 ? (
            <EmptyEdition dayKey={dayKey} />
          ) : (
            <>
              <DaySummary text={view.summary} />
              {lead && (
                <section className="mt-2 mb-8">
                  <div className="text-[11px] mono uppercase tracking-widest text-claude mb-3">The Big Story</div>
                  <SessionCard card={lead} featured />
                </section>
              )}
              {others.length > 0 && (
                <section>
                  <div className="text-[11px] mono uppercase tracking-widest text-claude mb-4">Also Today</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {others.map((c) => (
                      <SessionCard key={c.session.id} card={c} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
        <aside className="md:col-span-1 md:col-start-1 md:row-start-1 md:mt-2 md:sticky md:top-6 md:self-start">
          <DayStats stats={view.stats} projects={view.projects} />
        </aside>
      </div>

      <EndOfEdition dayKey={dayKey} />
    </div>
  );
}
