import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import { getSessionByInternalId } from '@/lib/db/repositories/sessions';

const exec = promisify(execFile);

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = getSessionByInternalId(params.id);
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!session.claude_session_id) {
    return NextResponse.json({ error: 'no_claude_session_id' }, { status: 400 });
  }

  const cwd = session.cwd || session.git_root || os.homedir();
  const cmd = `cd ${shellEscape(cwd)} && claude --resume ${shellEscape(session.claude_session_id)}`;

  if (process.platform !== 'darwin') {
    return NextResponse.json(
      {
        launched: false,
        platform: process.platform,
        command: cmd,
        reason: 'auto_launch_supported_on_macos_only',
        instruction: 'Copy the command and run it in your terminal.'
      },
      { status: 501 }
    );
  }

  try {
    const escaped = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const osascript = `tell application "Terminal" to do script "${escaped}"\ntell application "Terminal" to activate`;
    await exec('osascript', ['-e', osascript]);
    return NextResponse.json({ launched: true, command: cmd });
  } catch (err) {
    return NextResponse.json(
      { launched: false, command: cmd, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = getSessionByInternalId(params.id);
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!session.claude_session_id) {
    return NextResponse.json({ error: 'no_claude_session_id' }, { status: 400 });
  }
  const cwd = session.cwd || session.git_root || os.homedir();
  return NextResponse.json({
    command: `cd ${shellEscape(cwd)} && claude --resume ${shellEscape(session.claude_session_id)}`,
    canAutoLaunch: process.platform === 'darwin',
    platform: process.platform
  });
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
