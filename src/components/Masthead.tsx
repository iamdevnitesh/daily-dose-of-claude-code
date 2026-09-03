import Link from 'next/link';
import { prettyDate, todayLocal } from '@/lib/time';
import { DateNavigator } from './DateNavigator';
import { ThemeToggle } from './ThemeToggle';
import { LiveIndicator } from './LiveIndicator';

export function Masthead({ dayKey }: { dayKey: string }) {
  const today = todayLocal();
  const isToday = dayKey === today;
  return (
    <header className="pt-8 pb-6">
      <div className="flex items-center justify-between text-xs mono uppercase tracking-widest text-muted mb-2">
        <div className="flex items-center gap-3">
          <span>{isToday ? 'Today' : 'Archive Edition'}</span>
          {isToday && <LiveIndicator />}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/todos" className="hover:text-ink">Todos</Link>
          <Link href="/search" className="hover:text-ink">Search</Link>
          <Link href="/settings" className="hover:text-ink">Settings</Link>
          <ThemeToggle />
        </div>
      </div>
      <div className="hairline-top hairline-bottom py-4 text-center">
        <h1 className="serif text-4xl md:text-6xl font-black leading-none">DAILY DOSE OF CLAUDE CODE</h1>
        <div className="mt-2 text-xs mono uppercase tracking-widest text-muted">
          {prettyDate(dayKey)} · Local Edition
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <DateNavigator dayKey={dayKey} />
        <div className="text-xs mono text-muted hidden md:block">/day/{dayKey}</div>
      </div>
    </header>
  );
}
