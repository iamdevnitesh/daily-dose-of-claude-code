'use client';
import { useEffect, useState, useCallback } from 'react';

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
}

interface Props {
  dayKey: string;
  todosCreated: Todo[];
  todosCompleted: Todo[];
  openTodos: Todo[];
}

export function TodoDesk({ dayKey, openTodos: initialOpen, todosCreated, todosCompleted }: Props) {
  const [openTodos, setOpenTodos] = useState<Todo[]>(initialOpen);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/todos?status=active&limit=100');
    if (res.ok) setOpenTodos(await res.json());
  }, []);

  useEffect(() => {
    setOpenTodos(initialOpen);
  }, [initialOpen]);

  const toggle = async (t: Todo) => {
    const nextStatus = t.status === 'completed' ? 'open' : 'completed';
    setBusy(true);
    await fetch(`/api/todos/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });
    await refresh();
    setBusy(false);
  };

  const remove = async (t: Todo) => {
    if (!confirm(`Delete TODO: ${t.title}?`)) return;
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
      body: JSON.stringify({ title: title.trim(), priority, project: project.trim() || undefined, source: 'ui' })
    });
    setTitle('');
    setProject('');
    setPriority('medium');
    setShowForm(false);
    await refresh();
    setBusy(false);
  };

  return (
    <aside className="rule border-t md:border md:rounded-lg md:p-5 md:bg-card/40 pt-4">
      <div className="flex items-baseline justify-between">
        <h2 className="serif text-lg font-bold uppercase tracking-wider">The Todo Desk</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-xs mono uppercase tracking-widest text-claude hover:underline"
        >
          {showForm ? 'Cancel' : '+ Add TODO'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={add} className="mt-3 space-y-2 pb-3 hairline-bottom">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="TODO title"
            required
            autoFocus
            className="w-full rule border rounded-md bg-transparent px-3 py-2 text-sm"
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
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="project (optional)"
              className="flex-1 rule border rounded-md bg-transparent px-3 py-1.5 text-xs mono"
            />
            <button
              disabled={busy}
              className="rule border rounded-md px-3 py-1.5 text-xs mono uppercase tracking-widest hover:bg-card"
            >
              Add
            </button>
          </div>
        </form>
      )}

      <ul className="mt-3 space-y-2">
        {openTodos.length === 0 && (
          <li className="text-sm text-muted italic">No open TODOs. Add one above.</li>
        )}
        {openTodos.map((t) => (
          <li key={t.id} className="flex items-start gap-2 group">
            <button
              onClick={() => toggle(t)}
              aria-label="Toggle complete"
              className={`mt-0.5 shrink-0 w-5 h-5 rule border rounded-sm inline-flex items-center justify-center hover:bg-card ${
                t.status === 'completed' ? 'bg-claude/20' : ''
              }`}
            >
              {t.status === 'completed' ? '✓' : ''}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${t.status === 'completed' ? 'line-through text-muted' : ''}`}>
                {t.title}
              </div>
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

      {todosCreated.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] mono uppercase tracking-widest text-muted mb-2">Created that day</div>
          <ul className="space-y-1">
            {todosCreated.map((t) => (
              <li key={t.id} className="text-sm">
                <span className={t.status === 'completed' ? 'line-through text-muted' : ''}>{t.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {todosCompleted.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] mono uppercase tracking-widest text-muted mb-2">Completed that day</div>
          <ul className="space-y-1">
            {todosCompleted.map((t) => (
              <li key={t.id} className="text-sm text-muted line-through">
                {t.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      {dayKey && <div className="sr-only">{dayKey}</div>}
    </aside>
  );
}
