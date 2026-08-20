export function nowIso(): string {
  return new Date().toISOString();
}

export function localDayKey(iso: string, tz?: string): string {
  const d = new Date(iso);
  const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return fmt.format(d);
}

export function todayLocal(tz?: string): string {
  return localDayKey(nowIso(), tz);
}

export function formatClock(iso: string, tz?: string): string {
  const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(iso));
}

export function humanDuration(startIso?: string | null, endIso?: string | null): string | null {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function addDays(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function prettyDate(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(dt);
}
