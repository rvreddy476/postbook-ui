export const tokens = {
  colors: {
    asphalt: '#000000',
    paper: '#ffffff',
    white: '#ffffff',
    postgram: '#000000',
    posttube: '#000000',
    messenger: '#000000',
    commerce: '#000000',
  },
  space: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px' },
  radius: { sm: '8px', md: '12px', lg: '16px', xl: '20px', full: '9999px' },
  /*
    The type scale lives in src/ui/theme.css (--type-*); these read it so an
    inline style and a Tailwind text-* class can never disagree. Each entry
    is a CSS value: `style={{ fontSize: tokens.type.sm }}`. Pair it with
    `lineHeight: tokens.typeLineHeight.sm` when the element sets its own.
  */
  type: {
    '2xs': 'var(--type-2xs)',
    xs: 'var(--type-xs)',
    sm: 'var(--type-sm)',
    base: 'var(--type-base)',
    lg: 'var(--type-lg)',
    xl: 'var(--type-xl)',
    '2xl': 'var(--type-2xl)',
    '3xl': 'var(--type-3xl)',
    '4xl': 'var(--type-4xl)',
  },
  typeLineHeight: {
    '2xs': 'var(--type-2xs-lh)',
    xs: 'var(--type-xs-lh)',
    sm: 'var(--type-sm-lh)',
    base: 'var(--type-base-lh)',
    lg: 'var(--type-lg-lh)',
    xl: 'var(--type-xl-lh)',
    '2xl': 'var(--type-2xl-lh)',
    '3xl': 'var(--type-3xl-lh)',
    '4xl': 'var(--type-4xl-lh)',
  },
  blur: { sm: 'blur(8px)', md: 'blur(16px)', lg: 'blur(24px)', xl: 'blur(40px)' },
  z: { base: 0, raised: 10, sticky: 20, overlay: 30, modal: 40, toast: 50, top: 100 },
  duration: { fast: '100ms', normal: '200ms', slow: '300ms', xslow: '500ms' },
  shadow: {
    sm: '0 1px 3px rgba(48,47,44,0.06)',
    md: '0 4px 12px rgba(48,47,44,0.08)',
    lg: '0 8px 24px rgba(48,47,44,0.10)',
    xl: '0 16px 48px rgba(48,47,44,0.12)',
  },
} as const;
export type Tokens = typeof tokens;

/** @deprecated Use `tokens` instead */
export const uiTokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { md: 16, lg: 20, xl: 28 },
  blur: { soft: 14, medium: 16, strong: 18 },
  colors: { background: tokens.colors.asphalt, text: tokens.colors.white, muted: '#9CA3AF' },
} as const;
