import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureHookMerged,
  ensureMcpMerged,
  removeDailyDoseHooks,
  removeMcp,
  readJsonIfExists,
  backupFile
} from '../src/lib/installer/settingsMerge';
import { upsertClaudeMdSection, removeClaudeMdSection } from '../src/lib/installer/claudeMd';

describe('installer settings merge', () => {
  it('adds Daily Dose hook without disturbing existing hooks', () => {
    const start = {
      hooks: {
        SessionStart: [
          {
            hooks: [{ type: 'command', command: 'python3 /Users/x/.claude/hooks/existing.py', timeout: 5 }]
          }
        ]
      }
    };
    const next = ensureHookMerged(start, 'SessionStart', {
      hooks: [{ type: 'command', command: 'node /path/to/dist/hooks/session-start.js', timeout: 8 }]
    });
    expect(next.hooks!.SessionStart.length).toBe(2);
    // existing preserved
    expect(next.hooks!.SessionStart[0].hooks[0].command).toContain('existing.py');
  });

  it('is idempotent (running twice does not duplicate)', () => {
    const start = {} as any;
    const step1 = ensureHookMerged(start, 'Stop', {
      hooks: [{ type: 'command', command: 'node /d/dist/hooks/stop.js' }]
    });
    const step2 = ensureHookMerged(step1, 'Stop', {
      hooks: [{ type: 'command', command: 'node /d/dist/hooks/stop.js' }]
    });
    expect(step2.hooks!.Stop.length).toBe(1);
  });

  it('removes only Daily Dose hooks, preserving others', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: 'python /Users/x/.claude/hooks/memory-hook.py' }] },
          { hooks: [{ type: 'command', command: 'node /Users/x/daily-dose-of-claude-code/dist/hooks/stop.js' }] }
        ]
      }
    };
    const cleaned = removeDailyDoseHooks(settings);
    expect(cleaned.hooks!.Stop.length).toBe(1);
    expect(cleaned.hooks!.Stop[0].hooks[0].command).toContain('memory-hook.py');
  });

  it('adds and removes MCP entries', () => {
    let s: any = {};
    s = ensureMcpMerged(s, 'daily-dose', { type: 'stdio', command: 'node', args: ['/x'] });
    expect(s.mcpServers['daily-dose']).toBeTruthy();
    s = removeMcp(s, 'daily-dose');
    expect(s.mcpServers['daily-dose']).toBeUndefined();
  });

  it('creates a timestamped backup', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-'));
    const p = path.join(tmp, 'settings.json');
    fs.writeFileSync(p, '{"a":1}');
    const bak = backupFile(p);
    expect(bak).toBeTruthy();
    expect(fs.existsSync(bak!)).toBe(true);
    expect(fs.readFileSync(bak!, 'utf8')).toBe('{"a":1}');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('readJsonIfExists handles missing/invalid files', () => {
    expect(readJsonIfExists('/nonexistent/xxx.json')).toBeNull();
  });
});

describe('installer CLAUDE.md management', () => {
  it('creates, updates and removes managed section without touching surrounding content', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-md-'));
    const p = path.join(tmp, 'CLAUDE.md');
    fs.writeFileSync(p, '# Existing user rules\nDo not remove me.\n');
    const created = upsertClaudeMdSection(p);
    expect(created).toBe('updated');
    const contents = fs.readFileSync(p, 'utf8');
    expect(contents).toContain('# Existing user rules');
    expect(contents).toContain('<!-- DAILY_DOSE_START -->');
    // updating twice does not duplicate
    const again = upsertClaudeMdSection(p);
    expect(['unchanged', 'updated']).toContain(again);
    const occurrences = (fs.readFileSync(p, 'utf8').match(/DAILY_DOSE_START/g) || []).length;
    expect(occurrences).toBe(1);
    // remove keeps original
    const removed = removeClaudeMdSection(p);
    expect(removed).toBe(true);
    expect(fs.readFileSync(p, 'utf8')).toContain('# Existing user rules');
    expect(fs.readFileSync(p, 'utf8')).not.toContain('DAILY_DOSE_START');
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
