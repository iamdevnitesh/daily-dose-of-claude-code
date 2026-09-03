import { getDb } from '../db/client';
import { getSessionByInternalId, saveSessionSummary, type SessionRow } from '../db/repositories/sessions';
import { extractSessionTasks, type SessionTaskItem } from './tasks';
import { redactText } from '../redaction';
import { log } from '../logger';

const MODEL = process.env.DAILY_DOSE_HAIKU_MODEL || 'claude-haiku-4-5';

export interface SessionSummary {
  title: string;
  summary: string;
  tasks: SessionTaskItem[];
  source: 'haiku' | 'deterministic';
}

interface Aggregated {
  turnCount: number;
  turnTitles: string[];
  turnSummaries: string[];
  userPrompts: string[];
  filesTouched: string[];
  commandsRun: string[];
  toolFailures: number;
  durationMinutes: number | null;
  projectName: string | null;
  branch: string | null;
  startedAt: string;
  endedAt: string | null;
}

export function aggregateSession(session: SessionRow): Aggregated {
  const db = getDb();
  const turns = db
    .prepare(
      `SELECT title, summary, user_prompt, started_at, ended_at, files_modified_json, commands_run_json, tool_failures
       FROM turns WHERE session_id = ? ORDER BY started_at ASC`
    )
    .all(session.id) as Array<{
    title: string | null;
    summary: string | null;
    user_prompt: string | null;
    started_at: string;
    ended_at: string | null;
    files_modified_json: string | null;
    commands_run_json: string | null;
    tool_failures: number | null;
  }>;

  const files = new Set<string>();
  const commands: string[] = [];
  let toolFailures = 0;
  for (const t of turns) {
    if (t.files_modified_json) {
      try {
        for (const f of JSON.parse(t.files_modified_json) as string[]) files.add(f);
      } catch { /* ignore */ }
    }
    if (t.commands_run_json) {
      try {
        for (const c of JSON.parse(t.commands_run_json) as string[]) commands.push(c);
      } catch { /* ignore */ }
    }
    if (typeof t.tool_failures === 'number') toolFailures += t.tool_failures;
  }

  const started = turns[0]?.started_at || session.started_at;
  const ended = turns[turns.length - 1]?.ended_at || session.ended_at;
  const duration =
    started && ended ? Math.max(0, Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 60000)) : null;

  return {
    turnCount: turns.length,
    turnTitles: turns.map((t) => t.title).filter((x): x is string => !!x),
    turnSummaries: turns.map((t) => t.summary).filter((x): x is string => !!x),
    userPrompts: turns.map((t) => t.user_prompt).filter((x): x is string => !!x),
    filesTouched: Array.from(files),
    commandsRun: commands,
    toolFailures,
    durationMinutes: duration,
    projectName: session.project_name,
    branch: session.git_branch,
    startedAt: started,
    endedAt: ended
  };
}

export function deterministicSummary(agg: Aggregated): { title: string; summary: string } {
  const primaryTitle = agg.turnTitles[0] || agg.userPrompts[0]?.slice(0, 80) || 'Claude Code session';
  const cleanedTitle = primaryTitle.replace(/\s+/g, ' ').trim().slice(0, 90);

  const parts: string[] = [];
  const workNoun = agg.turnCount === 1 ? 'one task' : `${agg.turnCount} tasks`;
  const durationClause = agg.durationMinutes ? ` over ${humanMinutes(agg.durationMinutes)}` : '';
  const projectClause = agg.projectName ? ` in ${agg.projectName}` : '';
  parts.push(`Worked on ${workNoun}${projectClause}${durationClause}.`);

  if (agg.turnTitles.length > 1) {
    const bullets = agg.turnTitles.slice(0, 4).join(' · ');
    parts.push(bullets);
  }

  const stats: string[] = [];
  if (agg.filesTouched.length) stats.push(`${agg.filesTouched.length} files touched`);
  if (agg.commandsRun.length) stats.push(`${agg.commandsRun.length} commands run`);
  if (agg.toolFailures) stats.push(`${agg.toolFailures} tool failure${agg.toolFailures > 1 ? 's' : ''}`);
  if (stats.length) parts.push(stats.join(' · ') + '.');

  return {
    title: cleanedTitle,
    summary: parts.join(' ')
  };
}

async function callHaiku(prompt: string, apiKey: string): Promise<{ title: string; summary: string } | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system:
          'You summarise a completed Claude Code session into a short newspaper headline and a one-paragraph editorial summary. Output STRICT JSON with keys `title` (≤ 80 chars, imperative past tense, e.g. "Fixed BigQuery MV refresh") and `summary` (2–4 sentences, past tense, no bullet points). Do not include markdown, backticks, or preambles. Focus on WHAT WAS DONE, not the conversation.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      log.warn('summarize', 'haiku HTTP error', { status: res.status });
      return null;
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content || []).map((b) => b.text || '').join('').trim();
    const jsonSlice = text.match(/\{[\s\S]*\}/);
    if (!jsonSlice) return null;
    const parsed = JSON.parse(jsonSlice[0]) as { title?: string; summary?: string };
    if (!parsed.title || !parsed.summary) return null;
    return {
      title: parsed.title.slice(0, 100),
      summary: parsed.summary.trim()
    };
  } catch (err) {
    log.warn('summarize', 'haiku call failed', { err: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function buildHaikuPrompt(agg: Aggregated, tasks: SessionTaskItem[]): string {
  const lines: string[] = [];
  lines.push(`Project: ${agg.projectName || 'unknown'}${agg.branch ? ' · ' + agg.branch : ''}`);
  if (agg.durationMinutes) lines.push(`Duration: ${humanMinutes(agg.durationMinutes)}`);
  lines.push(`Turns: ${agg.turnCount}`);
  if (agg.turnTitles.length) {
    lines.push('');
    lines.push('Turn titles (chronological):');
    for (const t of agg.turnTitles.slice(0, 30)) lines.push(`- ${t}`);
  }
  if (agg.turnSummaries.length) {
    lines.push('');
    lines.push('Turn summaries:');
    for (const s of agg.turnSummaries.slice(0, 20)) lines.push(`- ${s}`);
  }
  if (tasks.length) {
    lines.push('');
    lines.push('Tasks Claude tracked in this session:');
    for (const t of tasks.slice(0, 30)) lines.push(`- [${t.status}] ${t.content}`);
  }
  if (agg.filesTouched.length) {
    lines.push('');
    lines.push(`Files touched (${agg.filesTouched.length}): ${agg.filesTouched.slice(0, 12).join(', ')}`);
  }
  if (agg.commandsRun.length) {
    lines.push('');
    lines.push(`Sample commands: ${agg.commandsRun.slice(0, 6).join(' | ')}`);
  }
  if (agg.userPrompts.length) {
    lines.push('');
    lines.push('First user prompt:');
    lines.push(agg.userPrompts[0].slice(0, 400));
  }
  return redactText(lines.join('\n'));
}

function humanMinutes(m: number): string {
  if (m < 1) return '<1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export interface SummarizeOptions {
  force?: boolean;
  useHaiku?: boolean;
}

export async function summarizeSession(sessionId: string, opts: SummarizeOptions = {}): Promise<SessionSummary | null> {
  const session = getSessionByInternalId(sessionId);
  if (!session) return null;

  const tasks = extractSessionTasks(sessionId);

  if (!opts.force && session.session_title && session.session_summary) {
    return {
      title: session.session_title,
      summary: session.session_summary,
      tasks,
      source: (session.summary_source as 'haiku' | 'deterministic') || 'deterministic'
    };
  }

  const agg = aggregateSession(session);
  if (agg.turnCount === 0) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const wantHaiku = opts.useHaiku !== false && !!apiKey;

  let title = '';
  let summary = '';
  let source: 'haiku' | 'deterministic' = 'deterministic';

  if (wantHaiku) {
    const prompt = buildHaikuPrompt(agg, tasks);
    const out = await callHaiku(prompt, apiKey!);
    if (out) {
      title = out.title;
      summary = out.summary;
      source = 'haiku';
    }
  }

  if (!title || !summary) {
    const det = deterministicSummary(agg);
    title = det.title;
    summary = det.summary;
    source = 'deterministic';
  }

  saveSessionSummary(sessionId, {
    title,
    summary,
    tasks_json: JSON.stringify(tasks),
    source
  });

  return { title, summary, tasks, source };
}
