import { describe, it, expect } from 'vitest';
import { localDayKey, addDays, prettyDate, humanDuration } from '../src/lib/time';

describe('time', () => {
  it('groups timestamps by local calendar day', () => {
    const key = localDayKey('2026-08-20T23:55:00-04:00', 'America/New_York');
    expect(key).toBe('2026-08-20');
  });

  it('groups late-night timestamps that cross midnight in UTC into the same local day', () => {
    // 2026-08-20 18:25 UTC == 2026-08-20 23:55 IST (same local day)
    const sameDay = localDayKey('2026-08-20T18:25:00Z', 'Asia/Kolkata');
    expect(sameDay).toBe('2026-08-20');
    // 2026-08-21 00:00 UTC == 2026-08-21 05:30 IST (next local day)
    const nextDay = localDayKey('2026-08-21T00:00:00Z', 'Asia/Kolkata');
    expect(nextDay).toBe('2026-08-21');
    // 2026-08-20 23:55 EDT (UTC-4) crosses the local day boundary depending on tz
    const nyc = localDayKey('2026-08-21T03:55:00Z', 'America/New_York');
    expect(nyc).toBe('2026-08-20');
  });

  it('addDays wraps correctly across months', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('prettyDate renders a weekday and month name', () => {
    const s = prettyDate('2026-08-20');
    expect(s).toMatch(/August/);
    expect(s).toMatch(/2026/);
  });

  it('humanDuration handles minutes/hours', () => {
    const a = new Date('2026-08-20T09:00:00Z').toISOString();
    const b = new Date('2026-08-20T09:42:00Z').toISOString();
    expect(humanDuration(a, b)).toBe('42 min');
    const c = new Date('2026-08-20T11:14:00Z').toISOString();
    expect(humanDuration(a, c)).toBe('2h 14m');
  });
});
