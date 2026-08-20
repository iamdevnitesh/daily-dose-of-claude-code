import { describe, it, expect } from 'vitest';
import { generateTitle, generateSummary, summarizeToolInput } from '../src/lib/summarize';

describe('summarize', () => {
  it('picks a verb + object title from user prompt', () => {
    expect(generateTitle('Debug why the materialized view is not refreshing')).toMatch(/Investigated/);
    expect(generateTitle('Fix the timezone bug in the API')).toMatch(/Fixed/);
    expect(generateTitle('Add retry logic to Kafka publisher')).toMatch(/Implemented/);
  });

  it('falls back to a cleaned prompt when no verb matches', () => {
    const t = generateTitle('hey can you look at the docs for jest');
    expect(t.length).toBeGreaterThan(0);
    expect(t.length).toBeLessThanOrEqual(80);
  });

  it('generates a summary that mentions files/commands', () => {
    const s = generateSummary({
      userPrompt: 'Ship the retry logic',
      assistantResponse: 'Added retries with backoff.',
      filesModified: ['a.ts', 'b.ts'],
      commandsRun: ['npm test'],
      toolFailures: 0
    });
    expect(s).toMatch(/2 files/);
    expect(s).toMatch(/1 command/);
  });

  it('summarizeToolInput handles Read/Edit/Bash concisely', () => {
    expect(summarizeToolInput('Read', { file_path: '/tmp/x.ts' })).toContain('Read');
    expect(summarizeToolInput('Edit', { file_path: '/tmp/x.ts' })).toContain('Modified');
    expect(summarizeToolInput('Bash', { command: 'npm test' })).toContain('npm test');
  });
});
