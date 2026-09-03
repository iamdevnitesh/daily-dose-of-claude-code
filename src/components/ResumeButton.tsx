'use client';
import { useEffect, useState } from 'react';

export function ResumeButton({ sessionId }: { sessionId: string }) {
  const [command, setCommand] = useState<string | null>(null);
  const [canLaunch, setCanLaunch] = useState(false);
  const [copied, setCopied] = useState(false);
  const [launchState, setLaunchState] = useState<'idle' | 'launching' | 'launched' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/session/${sessionId}/launch`)
      .then((r) => r.json())
      .then((d) => {
        setCommand(d.command);
        setCanLaunch(!!d.canAutoLaunch);
      })
      .catch(() => {
        setCommand(null);
      });
  }, [sessionId]);

  const doCopy = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const doLaunch = async () => {
    setLaunchState('launching');
    setError(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/launch`, { method: 'POST' });
      if (res.ok) {
        setLaunchState('launched');
        setTimeout(() => setLaunchState('idle'), 2500);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `${res.status}`);
        setLaunchState('error');
      }
    } catch (e) {
      setError(String(e));
      setLaunchState('error');
    }
  };

  return (
    <div className="rule border rounded-lg p-4 bg-card/40">
      <div className="text-[11px] mono uppercase tracking-widest text-muted mb-2">Resume this Claude session</div>
      <pre className="mono text-xs bg-paper/60 rule border rounded p-3 overflow-x-auto no-scrollbar">
        {command || 'Loading…'}
      </pre>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={doCopy}
          disabled={!command}
          className="rule border rounded-md px-3 py-1.5 text-xs mono uppercase tracking-widest hover:bg-card disabled:opacity-50"
        >
          {copied ? 'Copied' : 'Copy command'}
        </button>
        {canLaunch && (
          <button
            onClick={doLaunch}
            disabled={!command || launchState === 'launching'}
            className="rounded-md px-3 py-1.5 text-xs mono uppercase tracking-widest bg-claude text-paper hover:opacity-90 disabled:opacity-50"
          >
            {launchState === 'launching'
              ? 'Launching…'
              : launchState === 'launched'
                ? 'Launched ✓'
                : launchState === 'error'
                  ? 'Retry'
                  : 'Launch in Terminal'}
          </button>
        )}
      </div>
      {error && <div className="text-xs text-claude mt-2">Error: {error}</div>}
      {!canLaunch && command && (
        <div className="text-[10px] mono text-muted mt-2">
          Auto-launch is macOS-only. Copy the command and paste in your terminal.
        </div>
      )}
    </div>
  );
}
