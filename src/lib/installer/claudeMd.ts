import fs from 'node:fs';
import path from 'node:path';

export const DAILY_DOSE_START = '<!-- DAILY_DOSE_START -->';
export const DAILY_DOSE_END = '<!-- DAILY_DOSE_END -->';

export const MANAGED_BODY = `${DAILY_DOSE_START}

## Daily Dose Memory

A local Daily Dose memory system is available.

When the user explicitly asks you to:
- remember something
- add a TODO
- track something that needs to be done
- mark something complete
- recall previous work

use the Daily Dose MCP tools (\`daily_dose_add_todo\`, \`daily_dose_list_todos\`,
\`daily_dose_update_todo\`, \`daily_dose_complete_todo\`, \`daily_dose_delete_todo\`,
\`daily_dose_search_memory\`, \`daily_dose_get_day\`, \`daily_dose_get_recent_activity\`,
\`daily_dose_remember\`).

When you identify actionable TODOs while discussing "what remains to be done",
persist the TODOs once they are agreed/clearly established.

Do not persist passwords, authentication tokens, secrets, private keys,
environment variable values, or credentials.

${DAILY_DOSE_END}`;

export function upsertClaudeMdSection(claudeMdPath: string, body: string = MANAGED_BODY): 'created' | 'updated' | 'unchanged' {
  const dir = path.dirname(claudeMdPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(claudeMdPath)) {
    fs.writeFileSync(claudeMdPath, body + '\n');
    return 'created';
  }
  const existing = fs.readFileSync(claudeMdPath, 'utf8');
  const startIdx = existing.indexOf(DAILY_DOSE_START);
  const endIdx = existing.indexOf(DAILY_DOSE_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + DAILY_DOSE_END.length);
    const next = `${before}${body}${after}`;
    if (next === existing) return 'unchanged';
    fs.writeFileSync(claudeMdPath, next);
    return 'updated';
  }
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(claudeMdPath, existing + separator + body + '\n');
  return 'updated';
}

export function removeClaudeMdSection(claudeMdPath: string): boolean {
  if (!fs.existsSync(claudeMdPath)) return false;
  const existing = fs.readFileSync(claudeMdPath, 'utf8');
  const startIdx = existing.indexOf(DAILY_DOSE_START);
  const endIdx = existing.indexOf(DAILY_DOSE_END);
  if (startIdx === -1 || endIdx === -1) return false;
  const before = existing.slice(0, startIdx).replace(/\n+$/, '\n');
  const after = existing.slice(endIdx + DAILY_DOSE_END.length).replace(/^\n+/, '\n');
  const next = (before + after).replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(claudeMdPath, next);
  return true;
}
