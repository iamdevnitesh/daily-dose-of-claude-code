import { describe, it, expect } from 'vitest';

async function loadModules() {
  const sessions = await import('../src/lib/db/repositories/sessions');
  const turns = await import('../src/lib/db/repositories/turns');
  const tools = await import('../src/lib/db/repositories/toolEvents');
  const tasks = await import('../src/lib/session/tasks');
  const summarize = await import('../src/lib/session/summarize');
  return { sessions, turns, tools, tasks, summarize };
}

describe('session summarization', () => {
  it('extracts a task list from TodoWrite tool events, ordered completed → in_progress → pending', async () => {
    const { sessions, turns, tools, tasks } = await loadModules();
    const s = sessions.upsertSession({
      claude_session_id: 'ct-1',
      project_name: 'demo',
      cwd: '/tmp'
    });
    const t = turns.startTurn({
      session_id: s.id,
      claude_session_id: 'ct-1',
      prompt_id: 'p',
      user_prompt: 'Refactor the pipeline',
      project_name: 'demo'
    });
    tools.recordToolEvent({
      session_id: s.id,
      turn_id: t.id,
      tool_name: 'TodoWrite',
      event_type: 'success',
      input_summary: 'TodoWrite [{"content":"Design schema","status":"completed"},{"content":"Write tests","status":"in_progress"},{"content":"Ship","status":"pending"}]'
    });
    tools.recordToolEvent({
      session_id: s.id,
      turn_id: t.id,
      tool_name: 'TodoWrite',
      event_type: 'success',
      input_summary: 'TodoWrite [{"content":"Design schema","status":"completed"},{"content":"Write tests","status":"completed"},{"content":"Ship","status":"in_progress"}]'
    });

    const list = tasks.extractSessionTasks(s.id);
    expect(list.length).toBe(3);
    expect(list[0].status).toBe('completed');
    // Both "Design schema" and "Write tests" got marked completed by the 2nd write
    expect(list.filter((x) => x.status === 'completed').length).toBe(2);
    expect(list.find((x) => x.content === 'Ship')?.status).toBe('in_progress');
  });

  it('falls back to turns when no TodoWrite events exist', async () => {
    const { sessions, turns, tasks } = await loadModules();
    const s = sessions.upsertSession({ claude_session_id: 'ct-2', project_name: 'demo' });
    const t = turns.startTurn({
      session_id: s.id,
      claude_session_id: 'ct-2',
      prompt_id: 'p',
      user_prompt: 'Fix the timezone bug'
    });
    turns.finalizeTurn(t.id, {
      title: 'Fixed the timezone bug',
      status: 'completed',
      files_modified: ['/x.ts']
    });
    const list = tasks.extractSessionTasks(s.id);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].content).toMatch(/timezone/i);
  });

  it('deterministic summarizer produces a title + summary without external calls', async () => {
    const { sessions, turns, summarize } = await loadModules();
    const s = sessions.upsertSession({ claude_session_id: 'ct-3', project_name: 'reporting' });
    const a = turns.startTurn({
      session_id: s.id,
      claude_session_id: 'ct-3',
      prompt_id: 'p1',
      user_prompt: 'Debug MV refresh'
    });
    turns.finalizeTurn(a.id, {
      title: 'Investigated BigQuery MV refresh failure',
      summary: 'Diagnosed the MV refresh issue.',
      status: 'completed',
      files_modified: ['sql/mv.sql'],
      commands_run: ['Ran bq query'],
      tool_failures: 0
    });

    // Force deterministic by ensuring env var is absent
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const out = await summarize.summarizeSession(s.id, { force: true });
      expect(out).not.toBeNull();
      expect(out!.source).toBe('deterministic');
      expect(out!.title.length).toBeGreaterThan(0);
      expect(out!.summary.length).toBeGreaterThan(0);
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });

  it('saves the summary and returns cached value on subsequent calls', async () => {
    const { sessions, turns, summarize } = await loadModules();
    const s = sessions.upsertSession({ claude_session_id: 'ct-4', project_name: 'p4' });
    const t = turns.startTurn({
      session_id: s.id,
      claude_session_id: 'ct-4',
      prompt_id: 'p',
      user_prompt: 'Add retries'
    });
    turns.finalizeTurn(t.id, { title: 'Added retries', status: 'completed' });
    const first = await summarize.summarizeSession(s.id, {});
    expect(first).not.toBeNull();
    const row = sessions.getSessionByInternalId(s.id);
    expect(row!.session_title).toBe(first!.title);
    // Second call should return same title without regenerating
    const second = await summarize.summarizeSession(s.id, {});
    expect(second!.title).toBe(first!.title);
  });
});
