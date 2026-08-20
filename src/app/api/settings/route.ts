import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { loadConfig, saveConfig } from '@/lib/config';
import { CLAUDE_SETTINGS, CLAUDE_LOCAL_SETTINGS, CLAUDE_MD, DD_DB_PATH } from '@/lib/paths';
import { getDb } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

function readJson(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function status() {
  const s1 = readJson(CLAUDE_SETTINGS);
  const s2 = readJson(CLAUDE_LOCAL_SETTINGS);
  const hooks = new Set<string>();
  for (const s of [s1, s2]) {
    if (!s || !s.hooks) continue;
    for (const evt of Object.keys(s.hooks)) {
      const arr = s.hooks[evt];
      if (Array.isArray(arr)) {
        for (const entry of arr) {
          const cmds = (entry?.hooks || []).map((h: any) => h?.command || '');
          if (cmds.some((c: string) => c.includes('daily-dose'))) hooks.add(evt);
        }
      }
    }
  }
  const md = fs.existsSync(CLAUDE_MD) ? fs.readFileSync(CLAUDE_MD, 'utf8') : '';
  let dbHealthy = false;
  try {
    getDb().prepare('SELECT 1').get();
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }
  return {
    db_path: DD_DB_PATH,
    db_healthy: dbHealthy,
    hooks_configured: Array.from(hooks),
    mcp_configured: !!(s1?.mcpServers?.['daily-dose'] || s2?.mcpServers?.['daily-dose']),
    claude_md_managed: md.includes('<!-- DAILY_DOSE_START -->')
  };
}

export async function GET() {
  return NextResponse.json({ config: loadConfig(), status: status() });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const cfg = saveConfig(body);
  return NextResponse.json({ config: cfg, status: status() });
}
