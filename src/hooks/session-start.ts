#!/usr/bin/env node
import { readStdinJson, safeRun, pickString, trackingEnabled } from './shared';
import { upsertSession } from '../lib/db/repositories/sessions';
import { listTodos } from '../lib/db/repositories/todos';
import { recentActivity } from '../lib/db/repositories/day';
import { detectProject } from '../lib/project';
import { loadConfig } from '../lib/config';
import { log } from '../lib/logger';

async function main() {
  const payload = (await readStdinJson<any>()) || {};
  if (!trackingEnabled()) return;

  const claude_session_id = pickString(payload, 'session_id', 'claude_session_id');
  const cwd = pickString(payload, 'cwd', 'working_directory') || process.cwd();
  const source = pickString(payload, 'source') || 'startup';
  const transcript_path = pickString(payload, 'transcript_path');

  const project = detectProject(cwd);

  const session = upsertSession({
    claude_session_id,
    project_name: project.project_name,
    cwd: project.cwd,
    git_root: project.git_root,
    git_branch: project.git_branch,
    source,
    transcript_path
  });

  const cfg = loadConfig();
  const openTodos = listTodos({ status: 'active', project: project.project_name, limit: cfg.max_open_todos_in_context });
  const openTodosGeneral =
    openTodos.length < cfg.max_open_todos_in_context
      ? listTodos({ status: 'active', limit: cfg.max_open_todos_in_context - openTodos.length })
      : [];

  const combinedTodos = [...openTodos, ...openTodosGeneral.filter((g) => !openTodos.find((o) => o.id === g.id))].slice(
    0,
    cfg.max_open_todos_in_context
  );

  const recent = recentActivity(project.project_name, cfg.max_recent_activities_in_context);

  const lines: string[] = [];
  lines.push('Daily Dose context:');
  lines.push('');
  lines.push(`Project: ${project.project_name}${project.git_branch ? ` · ${project.git_branch}` : ''}`);
  lines.push(`Session: ${session.claude_session_id || session.id}${source && source !== 'startup' ? ` (${source})` : ''}`);
  lines.push('');
  if (combinedTodos.length) {
    lines.push(`Open TODOs (${combinedTodos.length}):`);
    for (const t of combinedTodos) {
      const p = t.project_name && t.project_name !== project.project_name ? ` [${t.project_name}]` : '';
      const pri = t.priority && t.priority !== 'medium' ? ` (${t.priority})` : '';
      lines.push(`- ${t.title}${p}${pri}`);
    }
    lines.push('');
  } else {
    lines.push('Open TODOs: none.');
    lines.push('');
  }
  if (recent.length) {
    lines.push(`Recent activity in ${project.project_name}:`);
    for (const r of recent) {
      lines.push(`- ${r.dayKey}: ${r.title || r.summary || r.id}`);
    }
    lines.push('');
  }
  lines.push('Use the daily-dose MCP tools to add/list/complete TODOs or search prior activity.');

  const context = lines.join('\n');
  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context
    }
  };
  process.stdout.write(JSON.stringify(output));
  log.info('session-start', 'injected context', {
    project: project.project_name,
    todos: combinedTodos.length,
    recent: recent.length
  });
}

safeRun('session-start', main).then(() => process.exit(0));
