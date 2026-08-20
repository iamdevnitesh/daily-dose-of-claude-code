#!/usr/bin/env node
import { readStdinJson, safeRun, pickString, trackingEnabled } from './shared';
import { findActiveTurn, findLatestTurn } from '../lib/db/repositories/turns';
import { findSessionByClaudeId } from '../lib/db/repositories/sessions';
import { recordToolEvent } from '../lib/db/repositories/toolEvents';
import { recordFileChange } from '../lib/db/repositories/fileChanges';
import { summarizeToolInput, summarizeToolOutput } from '../lib/summarize';
import { redactBashCommand } from '../lib/redaction';
import { loadConfig } from '../lib/config';
import { log } from '../lib/logger';
import path from 'node:path';

function extractToolName(payload: any): string | null {
  return (
    pickString(payload, 'tool_name', 'toolName', 'name') ||
    pickString(payload.tool || {}, 'name') ||
    null
  );
}

function extractToolInput(payload: any): any {
  return payload.tool_input || payload.toolInput || payload.input || payload.tool?.input || null;
}

function extractToolOutput(payload: any): any {
  return (
    payload.tool_response ||
    payload.tool_output ||
    payload.toolOutput ||
    payload.output ||
    payload.result ||
    null
  );
}

function extractSuccess(payload: any): boolean {
  const out = extractToolOutput(payload);
  if (out && typeof out === 'object' && (out.is_error === true || out.error === true || out.status === 'error')) {
    return false;
  }
  if (payload.error) return false;
  if (payload.exit_code && payload.exit_code !== 0) return false;
  return true;
}

function extractDuration(payload: any): number | null {
  const v =
    payload.duration_ms ??
    payload.durationMs ??
    payload.duration ??
    payload.tool?.duration_ms ??
    payload.tool?.duration ??
    null;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function absolutize(p: string, cwd: string | null | undefined): string {
  if (!p) return p;
  if (path.isAbsolute(p)) return p;
  return path.resolve(cwd || process.cwd(), p);
}

async function main() {
  const payload = (await readStdinJson<any>()) || {};
  if (!trackingEnabled()) return;

  const cfg = loadConfig();
  if (!cfg.store_command_metadata) return;

  const claude_session_id = pickString(payload, 'session_id', 'claude_session_id');
  if (!claude_session_id) return;

  const session = findSessionByClaudeId(claude_session_id);
  if (!session) return;

  const prompt_id = pickString(payload, 'prompt_id', 'user_prompt_id');
  const turn = findActiveTurn(session.id, prompt_id) || findLatestTurn(session.id);
  if (!turn) return;

  const toolName = extractToolName(payload);
  const toolInput = extractToolInput(payload);
  const toolOutput = extractToolOutput(payload);
  const success = extractSuccess(payload);
  const durationMs = extractDuration(payload);
  const tool_use_id = pickString(payload, 'tool_use_id', 'tool_use_uuid', 'id');

  let inputSummary = summarizeToolInput(toolName || 'tool', toolInput);
  if (String(toolName || '').toLowerCase() === 'bash' && toolInput?.command) {
    inputSummary = `Ran ${redactBashCommand(String(toolInput.command)).slice(0, 160)}`;
  }
  const outputSummary = summarizeToolOutput(toolName || 'tool', toolOutput, success);

  recordToolEvent({
    session_id: session.id,
    turn_id: turn.id,
    prompt_id: turn.prompt_id,
    tool_use_id,
    tool_name: toolName,
    event_type: success ? 'success' : 'failure',
    input_summary: inputSummary,
    output_summary: outputSummary || null,
    duration_ms: durationMs
  });

  const t = String(toolName || '').toLowerCase();
  if (success && toolInput) {
    if (t === 'edit' || t === 'multiedit' || t === 'multi_edit') {
      if (toolInput.file_path) {
        recordFileChange({
          session_id: session.id,
          turn_id: turn.id,
          prompt_id: turn.prompt_id,
          file_path: absolutize(String(toolInput.file_path), session.cwd || turn.cwd),
          operation: 'modified'
        });
      }
    } else if (t === 'write') {
      if (toolInput.file_path) {
        recordFileChange({
          session_id: session.id,
          turn_id: turn.id,
          prompt_id: turn.prompt_id,
          file_path: absolutize(String(toolInput.file_path), session.cwd || turn.cwd),
          operation: 'created'
        });
      }
    }
  }

  log.debug('post-tool-use', 'recorded', { tool: toolName, ok: success });
}

safeRun('post-tool-use', main).then(() => process.exit(0));
