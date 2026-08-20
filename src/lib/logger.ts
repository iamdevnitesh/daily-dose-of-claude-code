import fs from 'node:fs';
import { DD_HOOKS_LOG, ensureDirs } from './paths';

type Level = 'debug' | 'info' | 'warn' | 'error';

function write(level: Level, source: string, msg: string, extra?: unknown): void {
  try {
    ensureDirs();
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      source,
      msg,
      extra: extra ?? undefined
    });
    fs.appendFileSync(DD_HOOKS_LOG, line + '\n');
  } catch {
    // never throw from logger
  }
}

export const log = {
  debug: (source: string, msg: string, extra?: unknown) => write('debug', source, msg, extra),
  info: (source: string, msg: string, extra?: unknown) => write('info', source, msg, extra),
  warn: (source: string, msg: string, extra?: unknown) => write('warn', source, msg, extra),
  error: (source: string, msg: string, extra?: unknown) => write('error', source, msg, extra)
};
