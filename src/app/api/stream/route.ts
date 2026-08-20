import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      let lastCount = -1;
      const tick = async () => {
        if (cancelled) return;
        try {
          const db = getDb();
          const row = db.prepare('SELECT COUNT(*) as c FROM turns').get() as { c: number };
          if (row.c !== lastCount) {
            lastCount = row.c;
            send({ type: 'update', turns: row.c, ts: Date.now() });
          } else {
            send({ type: 'ping', ts: Date.now() });
          }
        } catch (err) {
          send({ type: 'error', message: String(err) });
        }
        if (!cancelled) setTimeout(tick, 4000);
      };
      send({ type: 'hello' });
      tick();
    },
    cancel() {
      cancelled = true;
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
