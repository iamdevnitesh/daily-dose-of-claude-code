#!/usr/bin/env node
import { readStdinJson, safeRun, pickString, trackingEnabled } from './shared';
import { findSessionByClaudeId } from '../lib/db/repositories/sessions';
import { findLatestTurn, finalizeTurn } from '../lib/db/repositories/turns';
import { dedupedFilesForTurn } from '../lib/db/repositories/fileChanges';
import { listToolEventsForTurn, countFailuresForTurn } from '../lib/db/repositories/toolEvents';
import { loadConfig } from '../lib/config';
import { generateTitle, generateSummary } from '../lib/summarize';
import { log } from '../lib/logger';
import { redactText } from '../lib/redaction';

function extractAssistantMessage(payload: any): string | null {
  const candidates = [
    payload.last_assistant_message,
    payload.assistant_message,
    payload.message,
    payload.response,
    payload.output_text,
    payload.text
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  const arr = payload.messages || payload.assistant_messages;
  if (Array.isArray(arr)) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const m = arr[i];
      if (!m) continue;
      if (m.role === 'assistant') {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          const text = m.content
            .filter((c: any) => c && c.type === 'text' && c.text)
            .map((c: any) => c.text)
            .join('\n');
          if (text.trim()) return text;
        }
      }
    }
  }
  return null;
}

async function main() {
  const payload = (await readStdinJson<any>()) || {};
  if (!trackingEnabled()) return;

  const cfg = loadConfig();

  const claude_session_id = pickString(payload, 'session_id', 'claude_session_id');
  if (!claude_session_id) return;

  const session = findSessionByClaudeId(claude_session_id);
  if (!session) return;

  const prompt_id = pickString(payload, 'prompt_id', 'user_prompt_id');
  const turn = findLatestTurn(session.id);
  if (!turn) return;

  if (prompt_id && turn.prompt_id && prompt_id !== turn.prompt_id) {
    // stale event for older turn - still safe to finalize latest
  }

  const assistantMessage = cfg.store_assistant_responses ? extractAssistantMessage(payload) : null;

  const files = dedupedFilesForTurn(turn.id);
  const events = listToolEventsForTurn(turn.id);
  const commands = events
    .filter((e) => (e.tool_name || '').toLowerCase() === 'bash' && e.input_summary)
    .map((e) => e.input_summary!)
    .slice(0, 50);
  const failures = countFailuresForTurn(turn.id);

  const title = generateTitle(turn.user_prompt, assistantMessage);
  const summary = generateSummary({
    userPrompt: turn.user_prompt,
    assistantResponse: assistantMessage,
    filesModified: files,
    commandsRun: commands,
    toolFailures: failures
  });

  finalizeTurn(turn.id, {
    assistant_response: assistantMessage ? redactText(assistantMessage) : null,
    title,
    summary,
    status: 'completed',
    files_modified: files,
    commands_run: commands,
    tool_failures: failures
  });

  log.info('stop', 'finalized turn', {
    turn: turn.id,
    project: turn.project_name,
    files: files.length,
    commands: commands.length,
    failures
  });
}

safeRun('stop', main).then(() => process.exit(0));
