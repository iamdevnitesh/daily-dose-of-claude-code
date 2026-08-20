import { NextResponse } from 'next/server';
import { buildDayView } from '@/lib/db/repositories/day';
import { todayLocal } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { date: string } }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayLocal();
  const view = buildDayView(day);
  return NextResponse.json(view);
}
