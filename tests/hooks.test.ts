import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function runHook(name: string, payload: any): { stdout: string; code: number } {
  const tsxBin = path.resolve(REPO, 'node_modules', '.bin', 'tsx');
  const script = path.join(REPO, 'src', 'hooks', `${name}.ts`);
  try {
    const stdout = execFileSync(tsxBin, [script], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, DAILY_DOSE_HOME: process.env.DAILY_DOSE_HOME },
      timeout: 12000
    });
    return { stdout, code: 0 };
  } catch (err: any) {
    return { stdout: err.stdout || '', code: err.status ?? 1 };
  }
}

describe('hooks end-to-end (invoked as subprocesses)', () => {
  it('SessionStart writes a session row and returns additionalContext', async () => {
    const cwd = process.cwd();
    const res = runHook('session-start', { session_id: 'test-1', cwd, source: 'startup' });
    expect(res.stdout).toContain('additionalContext');
    const sessions = await import('../src/lib/db/repositories/sessions');
    const row = sessions.findSessionByClaudeId('test-1');
    expect(row).toBeTruthy();
    expect(row?.claude_session_id).toBe('test-1');
  });

  it('UserPromptSubmit → PostToolUse → Stop finalizes a turn with title and files', async () => {
    // SessionStart to create session
    runHook('session-start', { session_id: 'test-2', cwd: process.cwd() });

    runHook('user-prompt-submit', {
      session_id: 'test-2',
      prompt_id: 'prompt-1',
      prompt: 'Debug why the pipeline is slow',
      cwd: process.cwd()
    });

    runHook('post-tool-use', {
      session_id: 'test-2',
      prompt_id: 'prompt-1',
      tool_name: 'Edit',
      tool_input: { file_path: '/tmp/x.ts' },
      tool_response: { ok: true }
    });

    runHook('post-tool-use', {
      session_id: 'test-2',
      prompt_id: 'prompt-1',
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
      tool_response: 'passed'
    });

    runHook('stop', {
      session_id: 'test-2',
      prompt_id: 'prompt-1',
      last_assistant_message: 'Found the bottleneck in the writer path.'
    });

    const sessions = await import('../src/lib/db/repositories/sessions');
    const turns = await import('../src/lib/db/repositories/turns');
    const s = sessions.findSessionByClaudeId('test-2');
    expect(s).toBeTruthy();
    const latest = turns.findLatestTurn(s!.id);
    expect(latest?.status).toBe('completed');
    expect(latest?.title).toBeTruthy();
    expect(latest?.title!.length).toBeGreaterThan(0);
    const files = latest?.files_modified_json ? JSON.parse(latest!.files_modified_json!) : [];
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('PreCompact records a compaction row', async () => {
    runHook('session-start', { session_id: 'test-3', cwd: process.cwd() });
    runHook('pre-compact', { session_id: 'test-3', trigger: 'auto' });

    const db = (await import('../src/lib/db/client')).getDb();
    const rows = db.prepare('SELECT * FROM compactions WHERE claude_session_id = ?').all('test-3') as any[];
    expect(rows.length).toBeGreaterThan(0);
  });

  it('SessionEnd marks the session ended', async () => {
    runHook('session-start', { session_id: 'test-4', cwd: process.cwd() });
    runHook('session-end', { session_id: 'test-4' });
    const sessions = await import('../src/lib/db/repositories/sessions');
    const row = sessions.findSessionByClaudeId('test-4');
    expect(row?.ended_at).toBeTruthy();
  });
});
