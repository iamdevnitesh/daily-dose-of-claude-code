import Link from 'next/link';
import { DD_DB_PATH } from '@/lib/paths';

export function EndOfEdition({ dayKey }: { dayKey: string }) {
  return (
    <footer className="mt-16 pt-6 hairline-top text-center text-xs mono uppercase tracking-widest text-muted">
      <div>— End of Edition —</div>
      <div className="mt-2 flex items-center justify-center gap-3 flex-wrap">
        <Link href={`/api/export/${dayKey}?format=md`} className="hover:text-ink">Export Markdown</Link>
        <span>·</span>
        <Link href={`/api/export/${dayKey}?format=json`} className="hover:text-ink">Export JSON</Link>
        <span>·</span>
        <span title={DD_DB_PATH}>Daily Dose of Claude Code</span>
      </div>
    </footer>
  );
}
