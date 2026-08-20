import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export interface ProjectInfo {
  cwd: string;
  git_root: string | null;
  git_branch: string | null;
  project_name: string;
}

function safeExec(cmd: string, args: string[], cwd: string): string | null {
  try {
    const out = execFileSync(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 800,
      encoding: 'utf8'
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

export function detectProject(cwdArg?: string): ProjectInfo {
  const cwd = cwdArg && fs.existsSync(cwdArg) ? cwdArg : process.cwd();
  const gitRoot = safeExec('git', ['rev-parse', '--show-toplevel'], cwd);
  const gitBranch = gitRoot ? safeExec('git', ['branch', '--show-current'], cwd) : null;
  const projectName = gitRoot ? path.basename(gitRoot) : path.basename(cwd);
  return {
    cwd,
    git_root: gitRoot,
    git_branch: gitBranch,
    project_name: projectName || 'unknown'
  };
}
