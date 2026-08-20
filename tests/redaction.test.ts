import { describe, it, expect } from 'vitest';
import { redactText, redactBashCommand } from '../src/lib/redaction';

describe('redaction', () => {
  it('redacts API_KEY assignments', () => {
    const out = redactText('const API_KEY=secret123xyzabcdef');
    expect(out).not.toContain('secret123xyzabcdef');
    expect(out).toContain('<redacted>');
  });

  it('redacts Bearer tokens', () => {
    const out = redactText('Authorization: Bearer abcdefg1234567890xyz');
    expect(out).toContain('<redacted>');
    expect(out).not.toContain('abcdefg1234567890xyz');
  });

  it('redacts common cloud/provider secret formats', () => {
    expect(redactText('ghp_1234567890abcdef1234567890abcdef1234')).toContain('<redacted');
    expect(redactText('AKIAABCDEFGHIJKLMNOP')).toContain('<redacted');
    expect(redactText('sk-1234567890abcdefghij1234567890abcdefgh')).toContain('<redacted');
  });

  it('redacts private key blocks', () => {
    const key = `-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJBAKj/asdf
-----END RSA PRIVATE KEY-----`;
    const out = redactText(key);
    expect(out).toContain('<redacted>');
    expect(out).not.toContain('MIIBOgIBAAJBAKj/asdf');
  });

  it('redacts likely secrets inside bash env dumps', () => {
    const out = redactBashCommand('env | grep TOKEN=abc123xyz');
    expect(out).toContain('=<redacted>');
  });

  it('leaves innocuous text alone', () => {
    const t = 'refactor Kafka publisher retry with exponential backoff';
    expect(redactText(t)).toBe(t);
  });
});
