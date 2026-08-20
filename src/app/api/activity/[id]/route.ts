import { NextResponse } from 'next/server';
import { getTurn } from '@/lib/db/repositories/turns';
import { listToolEventsForTurn } from '@/lib/db/repositories/toolEvents';
import { listFileChangesForTurn } from '@/lib/db/repositories/fileChanges';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const turn = getTurn(params.id);
  if (!turn) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({
    turn,
    events: listToolEventsForTurn(turn.id),
    files: listFileChangesForTurn(turn.id)
  });
}
