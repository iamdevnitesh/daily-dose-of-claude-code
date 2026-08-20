import Database from 'better-sqlite3';
import { DD_DB_PATH, ensureDirs } from '../paths';
import { runMigrations } from './migrations';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  ensureDirs();
  const db = new Database(DD_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  runMigrations(db);
  _db = db;
  return db;
}

export function closeDb(): void {
  if (_db) {
    try {
      _db.close();
    } catch {
      // ignore
    }
    _db = null;
  }
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
