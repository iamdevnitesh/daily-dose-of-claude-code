import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daily Dose of Claude Code',
  description: 'A newspaper-style memory of everything you do with Claude Code',
  icons: [{ rel: 'icon', url: '/favicon.svg' }]
};

const themeBoot = `
try {
  var t = localStorage.getItem('dd-theme');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark = t === 'dark' || (t !== 'light' && prefersDark);
  if (isDark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
