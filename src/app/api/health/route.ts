import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { CURRENT_SCHEMA_VERSION } from '@/lib/db/migrations';
import { DD_DB_PATH } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const row = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number | null };
    return NextResponse.json({
      ok: true,
      db_path: DD_DB_PATH,
      schema_version: row?.v ?? 0,
      current_schema_version: CURRENT_SCHEMA_VERSION
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
