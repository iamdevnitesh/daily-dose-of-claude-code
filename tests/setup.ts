import { beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmp: string | null = null;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-test-'));
  process.env.DAILY_DOSE_HOME = tmp;
  vi.resetModules();
});

afterEach(() => {
  if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  tmp = null;
});
