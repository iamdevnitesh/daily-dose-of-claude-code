#!/usr/bin/env node
import { readStdinJson, safeRun, pickString, trackingEnabled } from './shared';
import { upsertSession } from '../lib/db/repositories/sessions';
import { startTurn } from '../lib/db/repositories/turns';
import { detectProject } from '../lib/project';
import { loadConfig } from '../lib/config';
import { log } from '../lib/logger';

async function main() {
  const payload = (await readStdinJson<any>()) || {};
  if (!trackingEnabled()) return;

  const cfg = loadConfig();
  if (!cfg.store_user_prompts) return;

  const claude_session_id = pickString(payload, 'session_id', 'claude_session_id');
  const cwd = pickString(payload, 'cwd', 'working_directory') || process.cwd();
  const prompt = pickString(payload, 'prompt', 'user_prompt', 'user_message', 'input');
  const prompt_id = pickString(payload, 'prompt_id', 'user_prompt_id', 'submitId', 'id');

  if (!prompt) {
    log.debug('user-prompt-submit', 'no prompt in payload', { keys: Object.keys(payload) });
    return;
  }

  const project = detectProject(cwd);
  const session = upsertSession({
    claude_session_id,
    project_name: project.project_name,
    cwd: project.cwd,
    git_root: project.git_root,
    git_branch: project.git_branch
  });

  startTurn({
    session_id: session.id,
    claude_session_id,
    prompt_id,
    user_prompt: prompt,
    project_name: project.project_name,
    git_branch: project.git_branch,
    cwd: project.cwd
  });

  log.info('user-prompt-submit', 'turn started', {
    project: project.project_name,
    session: session.claude_session_id || session.id
  });
}

safeRun('user-prompt-submit', main).then(() => process.exit(0));
