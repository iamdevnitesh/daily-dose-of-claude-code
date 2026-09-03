import type Database from 'better-sqlite3';

interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          claude_session_id TEXT UNIQUE,
          project_name TEXT,
          cwd TEXT,
          git_root TEXT,
          git_branch TEXT,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          source TEXT,
          transcript_path TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_name);
        CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_claude ON sessions(claude_session_id);

        CREATE TABLE IF NOT EXISTS turns (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          claude_session_id TEXT,
          prompt_id TEXT,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          user_prompt TEXT,
          assistant_response TEXT,
          title TEXT,
          summary TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          project_name TEXT,
          git_branch TEXT,
          cwd TEXT,
          files_modified_json TEXT,
          commands_run_json TEXT,
          tool_failures INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
        CREATE INDEX IF NOT EXISTS idx_turns_started ON turns(started_at);
        CREATE INDEX IF NOT EXISTS idx_turns_project ON turns(project_name);
        CREATE INDEX IF NOT EXISTS idx_turns_prompt ON turns(prompt_id);
        CREATE INDEX IF NOT EXISTS idx_turns_status ON turns(status);

        CREATE TABLE IF NOT EXISTS tool_events (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          turn_id TEXT,
          prompt_id TEXT,
          tool_use_id TEXT,
          tool_name TEXT,
          event_type TEXT NOT NULL DEFAULT 'success',
          input_summary TEXT,
          output_summary TEXT,
          duration_ms INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_tool_turn ON tool_events(turn_id);
        CREATE INDEX IF NOT EXISTS idx_tool_session ON tool_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_tool_created ON tool_events(created_at);

        CREATE TABLE IF NOT EXISTS file_changes (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          turn_id TEXT,
          prompt_id TEXT,
          file_path TEXT NOT NULL,
          operation TEXT NOT NULL,
          timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_file_turn ON file_changes(turn_id);
        CREATE INDEX IF NOT EXISTS idx_file_session ON file_changes(session_id);
        CREATE INDEX IF NOT EXISTS idx_file_ts ON file_changes(timestamp);
        CREATE INDEX IF NOT EXISTS idx_file_path ON file_changes(file_path);

        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          priority TEXT NOT NULL DEFAULT 'medium',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT,
          due_at TEXT,
          source TEXT NOT NULL DEFAULT 'ui',
          source_session_id TEXT,
          source_prompt_id TEXT,
          project_name TEXT,
          tags_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
        CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_at);
        CREATE INDEX IF NOT EXISTS idx_todos_project ON todos(project_name);
        CREATE INDEX IF NOT EXISTS idx_todos_created ON todos(created_at);
        CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed_at);

        CREATE TABLE IF NOT EXISTS compactions (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          claude_session_id TEXT,
          trigger TEXT,
          occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
          snapshot_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_compactions_session ON compactions(session_id);

        CREATE TABLE IF NOT EXISTS settings_kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
          title,
          summary,
          user_prompt,
          assistant_response,
          project_name
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS todos_fts USING fts5(
          title,
          description,
          project_name
        );
      `);
    }
  },
  {
    version: 2,
    name: 'session_summary_fields',
    up: (db) => {
      const cols = (db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[]).map((c) => c.name);
      if (!cols.includes('session_title')) db.exec(`ALTER TABLE sessions ADD COLUMN session_title TEXT`);
      if (!cols.includes('session_summary')) db.exec(`ALTER TABLE sessions ADD COLUMN session_summary TEXT`);
      if (!cols.includes('session_tasks_json')) db.exec(`ALTER TABLE sessions ADD COLUMN session_tasks_json TEXT`);
      if (!cols.includes('summary_source')) db.exec(`ALTER TABLE sessions ADD COLUMN summary_source TEXT`);
      if (!cols.includes('summary_generated_at')) db.exec(`ALTER TABLE sessions ADD COLUMN summary_generated_at TEXT`);
    }
  }
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version)
  );
  const insert = db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)');
  const tx = db.transaction((m: Migration) => {
    m.up(db);
    insert.run(m.version, m.name);
  });
  for (const m of MIGRATIONS) {
    if (!applied.has(m.version)) {
      tx(m);
    }
  }
}

export const CURRENT_SCHEMA_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));
