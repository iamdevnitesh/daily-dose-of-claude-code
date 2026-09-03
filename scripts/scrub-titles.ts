#!/usr/bin/env tsx
// One-shot: strip Claude Code XML markers + long identifiers from any titles/
// summaries already persisted to the DB. Safe to re-run.
import { getDb } from '../src/lib/db/client';
import { stripTagsAndIds } from '../src/lib/summarize';

function main() {
  const db = getDb();

  const turnRows = db
    .prepare('SELECT id, title, summary FROM turns WHERE title IS NOT NULL OR summary IS NOT NULL')
    .all() as Array<{ id: string; title: string | null; summary: string | null }>;
  const updTurn = db.prepare('UPDATE turns SET title = ?, summary = ? WHERE id = ?');
  let turnsChanged = 0;
  for (const r of turnRows) {
    const nt = r.title ? stripTagsAndIds(r.title) : r.title;
    const ns = r.summary ? stripTagsAndIds(r.summary) : r.summary;
    if (nt !== r.title || ns !== r.summary) {
      updTurn.run(nt, ns, r.id);
      turnsChanged++;
    }
  }

  const sessionRows = db
    .prepare('SELECT id, session_title, session_summary FROM sessions WHERE session_title IS NOT NULL OR session_summary IS NOT NULL')
    .all() as Array<{ id: string; session_title: string | null; session_summary: string | null }>;
  const updSession = db.prepare('UPDATE sessions SET session_title = ?, session_summary = ? WHERE id = ?');
  let sessionsChanged = 0;
  for (const r of sessionRows) {
    const nt = r.session_title ? stripTagsAndIds(r.session_title) : r.session_title;
    const ns = r.session_summary ? stripTagsAndIds(r.session_summary) : r.session_summary;
    if (nt !== r.session_title || ns !== r.session_summary) {
      updSession.run(nt, ns, r.id);
      sessionsChanged++;
    }
  }

  console.log(`[ OK ] Scrubbed ${turnsChanged} turn(s) and ${sessionsChanged} session(s).`);
}

main();
