import { redactText } from './redaction';

const VERB_MAP: Array<[RegExp, string]> = [
  [/\b(debug|troubleshoot|diagnose|investigate)\b/i, 'Investigated'],
  [/\b(fix|patch|repair)\b/i, 'Fixed'],
  [/\b(add|create|introduce|implement|build)\b/i, 'Implemented'],
  [/\b(refactor|clean\s?up|restructure|reorganize)\b/i, 'Refactored'],
  [/\b(review|audit|inspect)\b/i, 'Reviewed'],
  [/\b(test|verify|validate)\b/i, 'Tested'],
  [/\b(deploy|release|ship)\b/i, 'Deployed'],
  [/\b(optimize|improve|speed\s?up|tune)\b/i, 'Optimized'],
  [/\b(update|change|modify|edit)\b/i, 'Updated'],
  [/\b(remove|delete|drop)\b/i, 'Removed'],
  [/\b(explore|research|explain|understand|analyze|analyse)\b/i, 'Explored']
];

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^([^.!?\n]{3,240}[.!?])/);
  return (m ? m[1] : trimmed.slice(0, 200)).trim();
}

function truncate(text: string, n: number): string {
  const t = text.trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd() + '…';
}

export function generateTitle(userPrompt: string | null | undefined, assistantResponse?: string | null): string {
  const prompt = redactText(userPrompt || '').trim();
  if (!prompt) {
    const resp = redactText(assistantResponse || '').trim();
    if (!resp) return 'Claude Session';
    return truncate(firstSentence(resp).replace(/^[\s"'`]*/, ''), 80);
  }

  const cleaned = prompt.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim();
  const firstLine = cleaned.split(/[.\n?!]/)[0]?.trim() || cleaned;
  let verb: string | null = null;
  for (const [re, v] of VERB_MAP) {
    if (re.test(cleaned)) {
      verb = v;
      break;
    }
  }
  const object = firstLine
    .replace(/^(please|can you|could you|help me|would you|hey|hi|kindly)\s+/i, '')
    .replace(/^(debug|fix|add|create|implement|build|write|refactor|review|test|deploy|update|remove|explain|understand|check)\s+/i, '')
    .trim();

  if (verb && object) return truncate(`${verb} ${object}`, 80);
  return truncate(firstLine.replace(/^(please|can you|could you|help me)\s+/i, ''), 80);
}

export function generateSummary(opts: {
  userPrompt?: string | null;
  assistantResponse?: string | null;
  filesModified?: string[];
  commandsRun?: string[];
  toolFailures?: number;
}): string {
  const parts: string[] = [];
  const resp = redactText(opts.assistantResponse || '').trim();
  if (resp) {
    parts.push(truncate(firstSentence(resp), 280));
  } else {
    const prompt = redactText(opts.userPrompt || '').trim();
    if (prompt) parts.push(truncate(firstSentence(prompt), 240));
  }
  const stats: string[] = [];
  if (opts.filesModified && opts.filesModified.length) {
    stats.push(`${opts.filesModified.length} file${opts.filesModified.length > 1 ? 's' : ''} touched`);
  }
  if (opts.commandsRun && opts.commandsRun.length) {
    stats.push(`${opts.commandsRun.length} command${opts.commandsRun.length > 1 ? 's' : ''} run`);
  }
  if (opts.toolFailures && opts.toolFailures > 0) {
    stats.push(`${opts.toolFailures} tool failure${opts.toolFailures > 1 ? 's' : ''}`);
  }
  if (stats.length) parts.push(stats.join(' · '));
  return parts.join(' ');
}

export function summarizeToolInput(toolName: string, input: any): string {
  if (!input) return toolName;
  const t = String(toolName || '').toLowerCase();
  try {
    switch (t) {
      case 'read':
      case 'read_file':
        return input.file_path || input.path ? `Read ${short(input.file_path || input.path)}` : 'Read a file';
      case 'edit':
      case 'multiedit':
      case 'multi_edit':
        return input.file_path ? `Modified ${short(input.file_path)}` : 'Edited a file';
      case 'write':
        return input.file_path ? `Wrote ${short(input.file_path)}` : 'Wrote a file';
      case 'bash':
        return input.command ? `Ran ${short(oneLine(input.command), 120)}` : 'Ran a shell command';
      case 'grep':
        return input.pattern ? `Searched for ${short(String(input.pattern), 80)}` : 'Grep search';
      case 'glob':
        return input.pattern ? `Globbed ${short(String(input.pattern), 80)}` : 'Glob';
      case 'webfetch':
      case 'web_fetch':
        return input.url ? `Fetched ${short(String(input.url), 100)}` : 'Web fetch';
      case 'websearch':
      case 'web_search':
        return input.query ? `Searched web for ${short(String(input.query), 80)}` : 'Web search';
      case 'task':
      case 'agent':
        return input.description ? `Delegated: ${short(String(input.description), 80)}` : 'Delegated task';
      default:
        if (t.startsWith('mcp__')) {
          return `MCP ${t.replace(/^mcp__/, '')}`;
        }
        const keys = Object.keys(input).slice(0, 2);
        return `${toolName}${keys.length ? ' ' + keys.map((k) => `${k}=${short(String(input[k]), 40)}`).join(' ') : ''}`;
    }
  } catch {
    return toolName;
  }
}

export function summarizeToolOutput(toolName: string, output: any, ok: boolean): string {
  const t = String(toolName || '').toLowerCase();
  const s = typeof output === 'string' ? output : (output ? JSON.stringify(output) : '');
  if (!ok) {
    return `Failed: ${truncate(redactText(oneLine(s)), 200)}`;
  }
  if (!s) return '';
  if (t === 'bash') {
    return truncate(redactText(oneLine(s)), 200);
  }
  return truncate(redactText(oneLine(s)), 160);
}

function oneLine(s: string): string {
  return String(s).replace(/\s+/g, ' ').trim();
}

function short(s: string, n = 60): string {
  const v = String(s || '').trim();
  if (v.length <= n) return v;
  return v.slice(0, n - 1) + '…';
}
