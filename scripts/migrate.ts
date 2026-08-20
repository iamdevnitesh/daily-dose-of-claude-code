#!/usr/bin/env tsx
import { getDb } from '../src/lib/db/client';
import { CURRENT_SCHEMA_VERSION } from '../src/lib/db/migrations';
import { DD_DB_PATH } from '../src/lib/paths';

const db = getDb();
const row = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number | null };
console.log(`Database ${DD_DB_PATH} at schema v${row?.v ?? 0} (current v${CURRENT_SCHEMA_VERSION})`);
