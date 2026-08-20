'use client';
import { useRouter } from 'next/navigation';
import { addDays, todayLocal } from '@/lib/time';

export function DateNavigator({ dayKey }: { dayKey: string }) {
  const router = useRouter();
  const today = todayLocal();
  const prev = addDays(dayKey, -1);
  const next = addDays(dayKey, 1);

  const go = (d: string) => router.push(`/day/${d}`);

  return (
    <div className="flex items-center gap-2 mono text-sm">
      <button
        onClick={() => go(prev)}
        aria-label="Previous day"
        className="rule border rounded-md w-9 h-9 hover:bg-card"
      >
        ←
      </button>
      <input
        type="date"
        value={dayKey}
        onChange={(e) => {
          if (e.target.value) go(e.target.value);
        }}
        className="rule border rounded-md bg-transparent px-3 py-1.5 text-sm min-w-[9.5rem]"
        aria-label="Select date"
      />
      <button
        onClick={() => go(next)}
        aria-label="Next day"
        className="rule border rounded-md w-9 h-9 hover:bg-card"
      >
        →
      </button>
      {dayKey !== today && (
        <button onClick={() => go(today)} className="rule border rounded-md px-3 py-1.5 hover:bg-card">
          Today
        </button>
      )}
    </div>
  );
}
