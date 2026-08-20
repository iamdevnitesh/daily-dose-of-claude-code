import { log } from '../lib/logger';
import { loadConfig } from '../lib/config';

export async function readStdinJson<T = any>(): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let data = '';
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, 3000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!data.trim()) return resolve(null);
      try {
        resolve(JSON.parse(data) as T);
      } catch (err) {
        log.warn('hook', 'failed to parse stdin JSON', { err: String(err) });
        resolve(null);
      }
    });
    process.stdin.on('error', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(null);
    });
  });
}

export function trackingEnabled(): boolean {
  try {
    return loadConfig().tracking_enabled;
  } catch {
    return true;
  }
}

export function safeRun(source: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .catch((err) => {
      try {
        log.error(source, 'hook error', { err: err instanceof Error ? err.stack || err.message : String(err) });
      } catch {
        // ignore
      }
    })
    .then(() => undefined);
}

export function pickString(obj: any, ...keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length) return v;
  }
  return null;
}
