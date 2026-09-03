'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  project_name: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  source: 'claude' | 'ui';
}

type Filter = 'active' | 'open' | 'in_progress' | 'completed';

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [project, setProject] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newProject, setNewProject] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ status: filter, limit: '500' });
    if (project) params.set('project', project);
    const res = await fetch(`/api/todos?${params}`);
    if (res.ok) setTodos(await res.json());
  }, [filter, project]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const projects = useMemo(() => {
    const set = new Set<string>();
    for (const t of todos) if (t.project_name) set.add(t.project_name);
    return Array.from(set).sort();
  }, [todos]);

  const toggle = async (t: Todo) => {
    const next = t.status === 'completed' ? 'open' : 'completed';
    setBusy(true);
    await fetch(`/api/todos/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next })
    });
    await refresh();
    setBusy(false);
  };

  const remove = async (t: Todo) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    setBusy(true);
    await fetch(`/api/todos/${t.id}`, { method: 'DELETE' });
    await refresh();
    setBusy(false);
  };

  const setPri = async (t: Todo, p: 'low' | 'medium' | 'high') => {
    setBusy(true);
    await fetch(`/api/todos/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: p })
    });
    await refresh();
    setBusy(false);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        priority,
        project: newProject.trim() || undefined,
        source: 'ui'
      })
    });
    setTitle('');
    setNewProject('');
    setPriority('medium');
    setShowForm(false);
    await refresh();
    setBusy(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 pb-24">
      <div className="flex items-center justify-between mb-6 text-xs mono uppercase tracking-widest text-muted">
        <Link href="/" className="hover:text-ink">← Back to today</Link>
        <div className="flex items-center gap-3">
          <Link href="/search" className="hover:text-ink">Search</Link>
          <Link href="/settings" className="hover:text-ink">Settings</Link>
        </div>
      </div>

      <h1 className="serif text-4xl md:text-5xl font-black leading-tight mb-2">The Todo Desk</h1>
      <p className="serif text-lg text-muted mb-6">
        Persistent items across every project and every Claude session.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['active', 'open', 'in_progress', 'completed'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rule border rounded-full px-3 py-1 text-[11px] mono uppercase tracking-widest ${
              filter === f ? 'bg-claude text-paper border-claude' : 'hover:bg-card'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="rule border rounded-md bg-transparent text-xs mono px-2 py-1"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="ml-auto text-xs mono uppercase tracking-widest text-claude hover:underline"
        >
          {showForm ? 'Cancel' : '+ Add TODO'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={add} className="rule border rounded-lg p-4 mb-6 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="TODO title"
            required
            autoFocus
            className="w-full rule border rounded-md bg-transparent px-3 py-2"
          />
          <div className="flex gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="rule border rounded-md bg-transparent px-2 py-1.5 text-xs mono"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <input
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              placeholder="project (optional)"
              className="flex-1 rule border rounded-md bg-transparent px-3 py-1.5 text-xs mono"
            />
            <button
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-xs mono uppercase tracking-widest bg-claude text-paper hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-2">
        {todos.length === 0 && <li className="text-sm text-muted italic">No TODOs match this filter.</li>}
        {todos.map((t) => (
          <li key={t.id} className="rule border rounded-lg p-3 flex items-start gap-3 group">
            <button
              onClick={() => toggle(t)}
              aria-label="Toggle complete"
              className={`mt-0.5 shrink-0 w-5 h-5 rule border rounded-sm inline-flex items-center justify-center hover:bg-card ${
                t.status === 'completed' ? 'bg-claude/25' : ''
              }`}
            >
              {t.status === 'completed' ? '✓' : ''}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${t.status === 'completed' ? 'line-through text-muted' : ''}`}>{t.title}</div>
              <div className="flex flex-wrap gap-x-3 text-[10px] mono uppercase tracking-widest text-muted mt-0.5">
                {t.project_name && <span>{t.project_name}</span>}
                <button
                  onClick={() =>
                    setPri(t, t.priority === 'high' ? 'medium' : t.priority === 'medium' ? 'low' : 'high')
                  }
                  className={`hover:text-ink ${t.priority === 'high' ? 'text-claude' : ''}`}
                >
                  {t.priority}
                </button>
                <span>{t.source}</span>
                {t.due_at && <span>due {new Date(t.due_at).toLocaleDateString()}</span>}
              </div>
            </div>
            <button
              onClick={() => remove(t)}
              aria-label="Delete"
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-claude text-xs px-1"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
