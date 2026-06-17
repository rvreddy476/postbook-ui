import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)', 'Outfit', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Space Mono', 'monospace'],
      },
      colors: {
        orchid: {
          violet: 'var(--prismatic-violet)',
          rose: 'var(--prismatic-rose)',
          bg: 'rgb(var(--brand-bg) / <alpha-value>)',
        },
        // Q&A / Ask feature brand color
        ask: {
          DEFAULT:  'rgb(var(--brand-accent) / <alpha-value>)',
          hover:    'rgb(var(--brand-highlight) / <alpha-value>)',
          light:    'rgb(var(--brand-text) / 0.08)',
          muted:    'rgb(var(--brand-text) / 0.15)',
          text:     'rgb(var(--brand-text) / <alpha-value>)',
        },
        // Brand Semantic Tokens
        brand: {
          bg: 'rgb(var(--brand-bg) / <alpha-value>)',
          text: 'rgb(var(--brand-text) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent) / <alpha-value>)',
          secondary: 'rgb(var(--brand-secondary) / <alpha-value>)',
          highlight: 'rgb(var(--brand-highlight) / <alpha-value>)',
          divider: 'var(--brand-divider)',
          card: 'rgb(var(--brand-card) / <alpha-value>)',
        },
        // Semantic tokens for profile components (maps to orchid palette)
        background: 'rgb(var(--brand-bg) / <alpha-value>)',
        foreground: 'rgb(var(--brand-text) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--brand-accent) / <alpha-value>)',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'rgb(var(--brand-secondary) / <alpha-value>)',
          foreground: 'rgb(var(--brand-text) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--brand-secondary) / <alpha-value>)',
          foreground: 'rgb(var(--brand-highlight) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        border: 'var(--brand-divider)',
        input: 'var(--brand-divider)',
        ring: 'rgb(var(--brand-accent) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};

export default config;
