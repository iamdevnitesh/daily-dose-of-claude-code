#!/usr/bin/env node
// Detached child spawned by session-end. Best-effort — logs and exits.
import { summarizeSession } from '../lib/session/summarize';
import { log } from '../lib/logger';

async function main() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    log.warn('summarizer', 'no sessionId provided');
    return;
  }
  try {
    const out = await summarizeSession(sessionId, { force: false });
    log.info('summarizer', 'session summarized', {
      sessionId,
      source: out?.source ?? 'skipped',
      title: out?.title?.slice(0, 60) ?? null
    });
  } catch (err) {
    log.error('summarizer', 'summarize failed', {
      sessionId,
      err: err instanceof Error ? err.stack || err.message : String(err)
    });
  }
}

main().finally(() => process.exit(0));
