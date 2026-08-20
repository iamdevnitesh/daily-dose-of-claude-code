import fs from 'node:fs';
import path from 'node:path';

export interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string; timeout?: number }>;
}

export interface ClaudeSettings {
  [key: string]: any;
  hooks?: Record<string, HookEntry[]>;
  mcpServers?: Record<string, any>;
}

export function readJsonIfExists<T = any>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function backupFile(p: string): string | null {
  if (!fs.existsSync(p)) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = `${p}.backup-${ts}`;
  fs.copyFileSync(p, bak);
  return bak;
}

export function writeJsonPreservingPermissions(p: string, data: any): void {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let prevMode: number | null = null;
  try {
    prevMode = fs.statSync(p).mode;
  } catch {
    prevMode = null;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  if (prevMode !== null) {
    try {
      fs.chmodSync(p, prevMode & 0o777);
    } catch {
      // ignore
    }
  }
}

export function ensureHookMerged(
  settings: ClaudeSettings,
  event: string,
  entry: HookEntry
): ClaudeSettings {
  const next = { ...settings };
  next.hooks = { ...(next.hooks || {}) };
  const existing = Array.isArray(next.hooks[event]) ? [...next.hooks[event]] : [];

  const targetCommand = entry.hooks[0]?.command;
  const hasSameCommand = existing.some((e) =>
    (e.hooks || []).some((h) => h.command === targetCommand)
  );
  if (hasSameCommand) {
    next.hooks[event] = existing;
    return next;
  }
  next.hooks[event] = [...existing, entry];
  return next;
}

export function removeDailyDoseHooks(settings: ClaudeSettings): ClaudeSettings {
  if (!settings.hooks) return settings;
  const next = { ...settings, hooks: { ...settings.hooks } };
  for (const event of Object.keys(next.hooks!)) {
    const arr = next.hooks![event];
    if (!Array.isArray(arr)) continue;
    const filtered = arr
      .map((entry) => ({
        ...entry,
        hooks: (entry.hooks || []).filter((h) => !isDailyDoseCommand(h.command))
      }))
      .filter((entry) => (entry.hooks || []).length > 0);
    if (filtered.length === 0) {
      delete next.hooks![event];
    } else {
      next.hooks![event] = filtered;
    }
  }
  return next;
}

export function isDailyDoseCommand(cmd: string): boolean {
  return /daily-dose/i.test(cmd) || cmd.includes('.daily-dose-claude');
}

export function ensureMcpMerged(settings: ClaudeSettings, name: string, mcp: any): ClaudeSettings {
  const next = { ...settings };
  next.mcpServers = { ...(next.mcpServers || {}) };
  next.mcpServers[name] = mcp;
  return next;
}

export function removeMcp(settings: ClaudeSettings, name: string): ClaudeSettings {
  if (!settings.mcpServers) return settings;
  const next = { ...settings, mcpServers: { ...settings.mcpServers } };
  delete next.mcpServers![name];
  return next;
}
