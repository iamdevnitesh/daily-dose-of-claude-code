import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        rule: 'rgb(var(--rule) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        claude: 'rgb(var(--claude) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)'
      },
      fontFamily: {
        serif: ['"Playfair Display"', '"Source Serif Pro"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      boxShadow: {
        paper: '0 1px 0 rgba(0,0,0,.02), 0 4px 20px -12px rgba(0,0,0,.06)'
      }
    }
  },
  plugins: []
};

export default config;
