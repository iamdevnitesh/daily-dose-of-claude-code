import { NextResponse } from 'next/server';
import { updateTodo, deleteTodo, getTodo } from '@/lib/db/repositories/todos';
import { TodoPatch } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const row = getTodo(params.id);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = TodoPatch.safeParse({ ...body, project_name: body.project ?? body.project_name });
  if (!parsed.success) return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  const row = updateTodo(params.id, parsed.data);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ok = deleteTodo(params.id);
  return NextResponse.json({ deleted: ok });
}
