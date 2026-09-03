import type { SessionTaskItem } from '@/lib/session/tasks';
import { formatClock } from '@/lib/time';

export function SessionTaskList({ tasks }: { tasks: SessionTaskItem[] }) {
  if (!tasks.length) {
    return <p className="text-sm text-muted italic">No task list captured for this session.</p>;
  }
  const done = tasks.filter((t) => t.status === 'completed');
  const active = tasks.filter((t) => t.status === 'in_progress');
  const pending = tasks.filter((t) => t.status === 'pending');

  return (
    <ol className="space-y-2">
      {done.map((t, i) => (
        <TaskRow key={`d-${i}`} task={t} icon="✓" tone="done" />
      ))}
      {active.map((t, i) => (
        <TaskRow key={`a-${i}`} task={t} icon="◐" tone="active" />
      ))}
      {pending.map((t, i) => (
        <TaskRow key={`p-${i}`} task={t} icon="◯" tone="pending" />
      ))}
    </ol>
  );
}

function TaskRow({ task, icon, tone }: { task: SessionTaskItem; icon: string; tone: 'done' | 'active' | 'pending' }) {
  const toneClass =
    tone === 'done' ? 'text-muted line-through' : tone === 'active' ? 'text-ink' : 'text-ink/85';
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={`mt-0.5 shrink-0 w-5 h-5 inline-flex items-center justify-center rounded-full text-xs ${
          tone === 'done' ? 'bg-claude/25 text-claude' : tone === 'active' ? 'bg-claude/10 text-claude' : 'rule border'
        }`}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${toneClass}`}>{task.content}</div>
        <div className="text-[10px] mono uppercase tracking-widest text-muted mt-0.5">
          {tone === 'done' ? `completed · ${formatClock(task.last_seen_at)}` : tone === 'active' ? 'in progress' : 'pending'}
        </div>
      </div>
    </li>
  );
}
