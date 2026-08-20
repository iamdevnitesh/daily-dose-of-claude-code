import { NextResponse } from 'next/server';
import { buildDayView } from '@/lib/db/repositories/day';
import { prettyDate, formatClock } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { date: string } }) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'md';
  const day = params.date;
  const view = buildDayView(day);

  if (format === 'json') {
    return NextResponse.json(view);
  }

  const lines: string[] = [];
  lines.push(`# Daily Dose — ${prettyDate(day)}`);
  lines.push('');
  if (view.summary) {
    lines.push(view.summary);
    lines.push('');
  }
  for (const t of view.turns) {
    lines.push(`## ${t.title || 'Untitled'}`);
    lines.push('');
    lines.push(
      `${formatClock(t.started_at)}${t.project_name ? ' · ' + t.project_name : ''}${
        t.git_branch ? ' · ' + t.git_branch : ''
      }`
    );
    lines.push('');
    if (t.summary) {
      lines.push(t.summary);
      lines.push('');
    }
    const files = t.files_modified_json ? (JSON.parse(t.files_modified_json) as string[]) : [];
    if (files.length) {
      lines.push('**Files:**');
      for (const f of files) lines.push(`- ${f}`);
      lines.push('');
    }
  }
  if (view.todosCreated.length || view.todosCompleted.length) {
    lines.push('## TODOs');
    for (const t of view.todosCreated) {
      lines.push(`- [${t.status === 'completed' ? 'x' : ' '}] ${t.title}`);
    }
    lines.push('');
  }
  const body = lines.join('\n');
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `inline; filename="daily-dose-${day}.md"`
    }
  });
}
