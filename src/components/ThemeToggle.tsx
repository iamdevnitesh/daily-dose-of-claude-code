'use client';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('dd-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('dd-theme', 'light');
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rule border rounded-full w-9 h-9 inline-flex items-center justify-center hover:bg-card transition"
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="text-lg leading-none">{isDark ? '☀' : '☾'}</span>
    </button>
  );
}
