import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        orchid: {
          violet: '#7c3aed',
          rose: '#db2777',
          bg: '#fcfaff',
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
