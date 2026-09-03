import { NextResponse } from 'next/server';
import { summarizeSession } from '@/lib/session/summarize';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const out = await summarizeSession(params.id, { force: true });
  if (!out) return NextResponse.json({ error: 'not_found_or_empty' }, { status: 404 });
  return NextResponse.json(out);
}
