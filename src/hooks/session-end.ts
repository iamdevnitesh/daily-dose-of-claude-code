#!/usr/bin/env node
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readStdinJson, safeRun, pickString, trackingEnabled } from './shared';
import { endSession, findSessionByClaudeId } from '../lib/db/repositories/sessions';
import { log } from '../lib/logger';

async function main() {
  const payload = (await readStdinJson<any>()) || {};
  if (!trackingEnabled()) return;

  const claude_session_id = pickString(payload, 'session_id', 'claude_session_id');
  if (!claude_session_id) return;

  endSession(claude_session_id);
  log.info('session-end', 'session ended', { session: claude_session_id });

  // Kick off session summarization in the background so the hook returns fast.
  // The child process must not block the parent — we detach and unref it.
  const session = findSessionByClaudeId(claude_session_id);
  if (session) {
    try {
      const script = path.join(__dirname, 'summarize-session.js');
      const child = spawn(process.execPath, [script, session.id], {
        detached: true,
        stdio: 'ignore',
        env: process.env
      });
      child.unref();
    } catch (err) {
      log.warn('session-end', 'failed to spawn summarizer', {
        err: err instanceof Error ? err.message : String(err)
      });
    }
  }
}

safeRun('session-end', main).then(() => process.exit(0));
