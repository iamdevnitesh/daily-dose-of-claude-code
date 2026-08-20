const SECRET_PATTERNS: Array<{ re: RegExp; replace: (m: string, ...groups: string[]) => string }> = [
  { re: /(Authorization\s*:\s*Bearer\s+)([A-Za-z0-9._\-]+)/gi, replace: (_m, p1) => `${p1}<redacted>` },
  { re: /(Bearer\s+)([A-Za-z0-9._\-]{16,})/g, replace: (_m, p1) => `${p1}<redacted>` },
  { re: /((?:api[_-]?key|apikey|password|passwd|pwd|secret|token|access[_-]?token|auth[_-]?token|client[_-]?secret|refresh[_-]?token|private[_-]?key|encryption[_-]?key)\s*[:=]\s*['"]?)([^'"\s\n]{4,})/gi, replace: (_m, p1) => `${p1}<redacted>` },
  { re: /(-----BEGIN [^-]+PRIVATE KEY-----)([\s\S]*?)(-----END [^-]+PRIVATE KEY-----)/g, replace: (_m, s, _mid, e) => `${s}\n<redacted>\n${e}` },
  { re: /(gh[pousr]_[A-Za-z0-9]{20,})/g, replace: () => '<redacted-github-token>' },
  { re: /(xox[baprs]-[A-Za-z0-9-]{10,})/g, replace: () => '<redacted-slack-token>' },
  { re: /(sk-[A-Za-z0-9]{20,})/g, replace: () => '<redacted-openai-key>' },
  { re: /(AIza[0-9A-Za-z\-_]{35})/g, replace: () => '<redacted-google-key>' },
  { re: /(AKIA[0-9A-Z]{16})/g, replace: () => '<redacted-aws-key>' },
  { re: /(ya29\.[A-Za-z0-9._\-]+)/g, replace: () => '<redacted-google-oauth>' }
];

const SUSPICIOUS_COMMANDS = /\b(env|printenv|export\s+[A-Z_][A-Z0-9_]*=|set\s+-a|cat\s+[^\s]*\.env)\b/;

export function redactText(input: string | null | undefined): string {
  if (!input) return '';
  let out = input;
  for (const p of SECRET_PATTERNS) {
    out = out.replace(p.re, p.replace as any);
  }
  return out;
}

export function redactBashCommand(cmd: string | null | undefined): string {
  if (!cmd) return '';
  let out = cmd;
  if (SUSPICIOUS_COMMANDS.test(out)) {
    out = out.replace(/=\S+/g, '=<redacted>');
  }
  return redactText(out);
}

export function looksLikeSecretLine(line: string): boolean {
  return /(?:api[_-]?key|password|secret|token|private[_-]?key)/i.test(line) && /[:=]/.test(line);
}
