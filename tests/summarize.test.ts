import { describe, it, expect } from 'vitest';
import { generateTitle, generateSummary, summarizeToolInput, stripTagsAndIds } from '../src/lib/summarize';

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

  it('stripTagsAndIds removes XML tags, tool-use ids, and long hex blobs', () => {
    const dirty =
      'Tested service · <task-notification> <task-id>bwd6vzm7u</task-id> <tool-use-id>toolu_019yXPqg6xT8abc</tool-use-id> and x-ua-token=6aa3fe3c683179948d37e2bf1c26b270';
    const clean = stripTagsAndIds(dirty);
    expect(clean).not.toMatch(/</);
    expect(clean).not.toMatch(/toolu_/);
    expect(clean).not.toMatch(/6aa3fe3c68317994/);
    expect(clean).toMatch(/Tested service/);
  });

  it('generateTitle strips tags/ids and produces a clean verb+object title', () => {
    const t = generateTitle(
      'Debug why <task-notification>the pipeline</task-notification> is slow — trace toolu_019yXPqg6xT8abc'
    );
    expect(t).not.toMatch(/</);
    expect(t).not.toMatch(/toolu_/);
    expect(t.length).toBeLessThanOrEqual(80);
  });
});
