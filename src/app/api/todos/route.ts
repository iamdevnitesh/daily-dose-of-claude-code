import { NextResponse } from 'next/server';
import { createTodo, listTodos } from '@/lib/db/repositories/todos';
import { TodoInput } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as any;
  const project = url.searchParams.get('project') || undefined;
  const limit = Number(url.searchParams.get('limit') || 500);
  const rows = listTodos({ status: status || undefined, project, limit });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = TodoInput.safeParse({
    ...body,
    project_name: body.project ?? body.project_name
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  }
  const row = createTodo(parsed.data);
  return NextResponse.json(row, { status: 201 });
}
