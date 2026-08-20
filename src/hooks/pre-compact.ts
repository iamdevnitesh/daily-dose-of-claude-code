#!/usr/bin/env node
import { readStdinJson, safeRun, pickString, trackingEnabled } from './shared';
import { findSessionByClaudeId } from '../lib/db/repositories/sessions';
import { findLatestTurn, finalizeTurn } from '../lib/db/repositories/turns';
import { recordCompaction } from '../lib/db/repositories/compactions';
import { listTodos } from '../lib/db/repositories/todos';
import { log } from '../lib/logger';

async function main() {
  const payload = (await readStdinJson<any>()) || {};
  if (!trackingEnabled()) return;

  const claude_session_id = pickString(payload, 'session_id', 'claude_session_id');
  const trigger = pickString(payload, 'trigger', 'source', 'reason') || 'unknown';

  if (claude_session_id) {
    const session = findSessionByClaudeId(claude_session_id);
    if (session) {
      const turn = findLatestTurn(session.id);
      if (turn && turn.status === 'active') {
        finalizeTurn(turn.id, { status: 'interrupted' });
      }
      const openTodos = listTodos({ status: 'active', limit: 50 }).map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        project: t.project_name
      }));
      recordCompaction({
        session_id: session.id,
        claude_session_id,
        trigger,
        snapshot: {
          project: session.project_name,
          branch: session.git_branch,
          latest_turn: turn?.id,
          open_todos: openTodos
        }
      });
      log.info('pre-compact', 'snapshot recorded', { trigger, session: claude_session_id });
      return;
    }
  }

  recordCompaction({ claude_session_id, trigger });
  log.info('pre-compact', 'compaction recorded without session', { trigger });
}

safeRun('pre-compact', main).then(() => process.exit(0));
