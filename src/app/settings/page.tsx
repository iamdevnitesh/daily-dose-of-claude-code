'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Cfg {
  tracking_enabled: boolean;
  store_user_prompts: boolean;
  store_assistant_responses: boolean;
  store_command_metadata: boolean;
  store_raw_transcripts: boolean;
  theme: 'auto' | 'light' | 'dark';
}

interface Status {
  db_path: string;
  db_healthy: boolean;
  hooks_configured: string[];
  mcp_configured: boolean;
  claude_md_managed: boolean;
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        setCfg(d.config);
        setStatus(d.status);
      });
  }, []);

  const save = async (patch: Partial<Cfg>) => {
    if (!cfg) return;
    setBusy(true);
    const next = { ...cfg, ...patch };
    setCfg(next);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    setBusy(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <Link href="/" className="text-xs mono uppercase tracking-widest text-muted hover:text-ink">
        ← Back
      </Link>
      <h1 className="serif text-4xl font-black mt-4 mb-6">Settings</h1>

      {cfg && (
        <div className="space-y-3">
          {[
            ['tracking_enabled', 'Tracking enabled'],
            ['store_user_prompts', 'Store user prompts'],
            ['store_assistant_responses', 'Store assistant responses'],
            ['store_command_metadata', 'Store command metadata'],
            ['store_raw_transcripts', 'Store raw transcripts (default off)']
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-3 border rule rounded-lg px-4 py-3">
              <input
                type="checkbox"
                checked={(cfg as any)[k]}
                onChange={(e) => save({ [k]: e.target.checked } as any)}
                disabled={busy}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}

      {status && (
        <section className="mt-10">
          <h2 className="serif text-2xl font-bold mb-3">Integration Status</h2>
          <ul className="mono text-sm space-y-1">
            <li>Database: {status.db_healthy ? '✓ healthy' : '✗ error'} ({status.db_path})</li>
            <li>MCP: {status.mcp_configured ? '✓ registered' : '✗ not registered'}</li>
            <li>CLAUDE.md managed section: {status.claude_md_managed ? '✓ installed' : '✗ missing'}</li>
            <li>Hooks configured: {status.hooks_configured.join(', ') || '(none)'}</li>
          </ul>
        </section>
      )}
    </div>
  );
}
