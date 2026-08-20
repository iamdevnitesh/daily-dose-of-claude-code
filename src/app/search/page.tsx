'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Result {
  activities: { id: string; day: string; project: string | null; title: string | null; summary: string | null }[];
  todos: { id: string; title: string; status: string; priority: string; project: string | null }[];
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) return setData(null);
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        setData(await r.json());
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <Link href="/" className="text-xs mono uppercase tracking-widest text-muted hover:text-ink">
        ← Back
      </Link>
      <h1 className="serif text-4xl font-black mt-4 mb-6">Search The Archive</h1>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="BigQuery, Kafka, timezone, materialized view…"
        className="w-full rule border rounded-lg bg-transparent px-4 py-3 text-lg"
      />
      {loading && <div className="text-xs mono text-muted mt-3">Searching…</div>}

      {data && (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-xs mono uppercase tracking-widest text-claude mb-2">
              Activities · {data.activities.length}
            </h2>
            <ul className="space-y-3">
              {data.activities.map((a) => (
                <li key={a.id} className="border rule rounded-lg p-3">
                  <div className="text-[11px] mono uppercase tracking-widest text-muted">
                    {a.day} {a.project ? `· ${a.project}` : ''}
                  </div>
                  <Link href={`/activity/${a.id}`} className="serif text-lg font-bold hover:underline">
                    {a.title || 'Untitled'}
                  </Link>
                  {a.summary && <div className="text-sm text-ink/80 mt-1">{a.summary}</div>}
                </li>
              ))}
              {data.activities.length === 0 && <li className="text-sm text-muted italic">No matching activities.</li>}
            </ul>
          </section>

          <section>
            <h2 className="text-xs mono uppercase tracking-widest text-claude mb-2">
              TODOs · {data.todos.length}
            </h2>
            <ul className="space-y-2">
              {data.todos.map((t) => (
                <li key={t.id} className="border rule rounded-lg p-3 flex items-baseline justify-between">
                  <span className={t.status === 'completed' ? 'line-through text-muted' : ''}>{t.title}</span>
                  <span className="text-[11px] mono text-muted">
                    {t.status} · {t.priority}
                    {t.project ? ` · ${t.project}` : ''}
                  </span>
                </li>
              ))}
              {data.todos.length === 0 && <li className="text-sm text-muted italic">No matching TODOs.</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
