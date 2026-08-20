import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..');

interface JsonRpcMsg {
  jsonrpc: string;
  id?: number;
  result?: any;
  error?: any;
}

function talkToServer(messages: any[]): Promise<JsonRpcMsg[]> {
  return new Promise((resolve, reject) => {
    const tsxBin = path.resolve(REPO, 'node_modules', '.bin', 'tsx');
    const server = spawn(tsxBin, [path.join(REPO, 'src', 'mcp', 'server.ts')], {
      env: { ...process.env, DAILY_DOSE_HOME: process.env.DAILY_DOSE_HOME },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let out = '';
    server.stdout.on('data', (b) => {
      out += b.toString('utf8');
    });
    server.on('error', reject);

    let killed = false;
    const kill = () => {
      if (killed) return;
      killed = true;
      try {
        server.kill('SIGKILL');
      } catch {}
    };

    // send all messages then wait
    setTimeout(() => {
      for (const m of messages) {
        server.stdin.write(JSON.stringify(m) + '\n');
      }
    }, 300);

    setTimeout(() => {
      kill();
      const results: JsonRpcMsg[] = [];
      for (const line of out.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          results.push(JSON.parse(trimmed));
        } catch {
          // ignore
        }
      }
      resolve(results);
    }, 2500);
  });
}

describe('MCP server', () => {
  it('lists tools and calls add_todo/list_todos/complete_todo/search_memory', async () => {
    const results = await talkToServer([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } } },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'daily_dose_add_todo', arguments: { title: 'Investigate Redis latency', priority: 'high', project: 'reporting' } }
      },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'daily_dose_list_todos', arguments: { status: 'active' } } },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'daily_dose_search_memory', arguments: { query: 'Redis' } } }
    ]);

    // find tools/list
    const list = results.find((r) => r.id === 2);
    expect(list?.result?.tools?.length).toBeGreaterThan(5);
    const names = (list?.result?.tools || []).map((t: any) => t.name);
    expect(names).toContain('daily_dose_add_todo');
    expect(names).toContain('daily_dose_search_memory');

    const added = results.find((r) => r.id === 3);
    expect(JSON.stringify(added?.result)).toContain('Added TODO');

    const listed = results.find((r) => r.id === 4);
    const txt = listed?.result?.content?.[0]?.text || '';
    expect(txt).toContain('Redis latency');

    const searched = results.find((r) => r.id === 5);
    expect(searched?.result?.content?.[0]?.text).toContain('Redis');
  }, 15000);
});
