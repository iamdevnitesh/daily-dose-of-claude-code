import { buildDayView } from '@/lib/db/repositories/day';
import { Masthead } from '@/components/Masthead';
import { LeadStory } from '@/components/LeadStory';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { TodoDesk } from '@/components/TodoDesk';
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
  const lead = view.leadStoryId ? view.turns.find((t) => t.id === view.leadStoryId) : null;
  const isToday = dayKey === todayLocal();

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pb-24">
      <Masthead dayKey={dayKey} />
      {isToday && <AutoRefresh />}

      <div className="grid grid-cols-1 md:grid-cols-3 md:gap-10 mt-2">
        <main className="md:col-span-2 md:col-start-2 md:row-start-1">
          {view.turns.length === 0 ? (
            <EmptyEdition dayKey={dayKey} />
          ) : (
            <>
              <DaySummary text={view.summary} />
              {lead && <LeadStory turn={lead} />}
              <ActivityTimeline turns={view.turns} leadId={view.leadStoryId} />
            </>
          )}
        </main>
        <aside className="md:col-span-1 md:col-start-1 md:row-start-1 space-y-6 md:mt-2 md:sticky md:top-6 md:self-start">
          <TodoDesk
            dayKey={dayKey}
            openTodos={view.openTodos}
            todosCreated={view.todosCreated}
            todosCompleted={view.todosCompleted}
          />
          <DayStats stats={view.stats} projects={view.projects} />
        </aside>
      </div>

      <EndOfEdition dayKey={dayKey} />
    </div>
  );
}
