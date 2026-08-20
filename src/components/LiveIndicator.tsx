'use client';
import { useEffect, useState } from 'react';

export function LiveIndicator() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    let mounted = true;
    fetch('/api/health').then((r) => mounted && setLive(r.ok)).catch(() => mounted && setLive(false));
    return () => {
      mounted = false;
    };
  }, []);
  if (!live) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="dot-pulse" aria-hidden />
      Live
    </span>
  );
}
