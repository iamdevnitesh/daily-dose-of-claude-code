import { describe, it, expect } from 'vitest';

async function loadRepos() {
  const sessions = await import('../src/lib/db/repositories/sessions');
  const turns = await import('../src/lib/db/repositories/turns');
  const todos = await import('../src/lib/db/repositories/todos');
  const day = await import('../src/lib/db/repositories/day');
  const tools = await import('../src/lib/db/repositories/toolEvents');
  const files = await import('../src/lib/db/repositories/fileChanges');
  const time = await import('../src/lib/time');
  return { sessions, turns, todos, day, tools, files, time };
}

describe('database', () => {
  it('runs migrations and creates sessions/turns', async () => {
    const { sessions, turns } = await loadRepos();
    const s = sessions.upsertSession({
      claude_session_id: 'c1',
      project_name: 'p',
      cwd: '/tmp',
      git_root: '/tmp',
      git_branch: 'main'
    });
    expect(s.id).toBeTruthy();

    const t = turns.startTurn({
      session_id: s.id,
      claude_session_id: 'c1',
      prompt_id: 'pr1',
      user_prompt: 'Do the thing',
      project_name: 'p'
    });
    expect(t.status).toBe('active');

    const finalized = turns.finalizeTurn(t.id, {
      assistant_response: 'ok',
      title: 'Did the thing',
      summary: 'summary',
      status: 'completed',
      files_modified: ['/tmp/a.ts', '/tmp/a.ts'],
      commands_run: ['ls'],
      tool_failures: 0
    });
    expect(finalized.status).toBe('completed');
    expect(finalized.title).toBe('Did the thing');
    expect(JSON.parse(finalized.files_modified_json!)).toEqual(['/tmp/a.ts', '/tmp/a.ts']);
  });

  it('todos: create, update, complete, search, day attribution', async () => {
    const { todos, time } = await loadRepos();
    const a = todos.createTodo({
      title: 'Investigate BigQuery cost',
      priority: 'high',
      project_name: 'reporting',
      source: 'ui',
      status: 'open'
    });
    const b = todos.createTodo({
      title: 'Kafka retry tests',
      priority: 'medium',
      project_name: 'kafka',
      source: 'claude',
      status: 'open'
    });
    todos.updateTodo(b.id, { status: 'completed' });
    const open = todos.listTodos({ status: 'active' });
    expect(open.map((t) => t.id)).toContain(a.id);
    expect(open.map((t) => t.id)).not.toContain(b.id);

    const found = todos.findTodoByTitleLike('BigQuery');
    expect(found?.id).toBe(a.id);

    const searched = todos.searchTodos('BigQuery');
    expect(searched.length).toBeGreaterThan(0);

    const today = time.todayLocal();
    const createdToday = todos.todosCreatedOnDay(today);
    expect(createdToday.length).toBeGreaterThanOrEqual(2);
    const completedToday = todos.todosCompletedOnDay(today);
    expect(completedToday.map((t) => t.id)).toContain(b.id);
  });

  it('day view aggregates turns + todos + stats', async () => {
    const { sessions, turns, todos, day, files, time } = await loadRepos();
    const s = sessions.upsertSession({ claude_session_id: 'c2', project_name: 'x' });
    const t = turns.startTurn({
      session_id: s.id,
      claude_session_id: 'c2',
      prompt_id: 'p',
      user_prompt: 'Fix the bug',
      project_name: 'x'
    });
    files.recordFileChange({ session_id: s.id, turn_id: t.id, file_path: '/tmp/x.ts', operation: 'modified' });
    turns.finalizeTurn(t.id, {
      status: 'completed',
      files_modified: ['/tmp/x.ts'],
      commands_run: ['Ran npm test'],
      tool_failures: 0,
      title: 'Fix bug',
      summary: 'Fixed it'
    });
    todos.createTodo({ title: 'follow up', source: 'ui', status: 'open', priority: 'medium' });
    const view = day.buildDayView(time.todayLocal());
    expect(view.turns.length).toBeGreaterThanOrEqual(1);
    expect(view.stats.filesTouched).toBeGreaterThanOrEqual(1);
    expect(view.stats.projectCount).toBeGreaterThanOrEqual(1);
    expect(view.leadStoryId).toBeTruthy();
  });
});
