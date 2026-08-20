#!/usr/bin/env node
import { readStdinJson, safeRun, pickString, trackingEnabled } from './shared';
import { endSession } from '../lib/db/repositories/sessions';
import { log } from '../lib/logger';

async function main() {
  const payload = (await readStdinJson<any>()) || {};
  if (!trackingEnabled()) return;

  const claude_session_id = pickString(payload, 'session_id', 'claude_session_id');
  if (!claude_session_id) return;
  endSession(claude_session_id);
  log.info('session-end', 'session ended', { session: claude_session_id });
}

safeRun('session-end', main).then(() => process.exit(0));
