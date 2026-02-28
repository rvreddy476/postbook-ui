import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        orchid: {
          violet: '#7c3aed',
          rose: '#db2777',
          bg: '#fcfaff',
        },
        // Semantic tokens for profile components (maps to orchid palette)
        background: '#fcfaff',
        foreground: '#0f172a',
        primary: {
          DEFAULT: '#7c3aed',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#f3e8ff',
          foreground: '#6d28d9',
        },
        muted: {
          DEFAULT: '#f5f3ff',
          foreground: '#64748b',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        border: '#e9d5ff',
        input: '#e9d5ff',
        ring: '#7c3aed',
      },
    },
  },
  plugins: [],
};

export default config;
