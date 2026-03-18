export const tokens = {
  colors: {
    asphalt: '#302f2c',
    paper: '#efede3',
    white: '#ffffff',
    postgram: '#FF3366',
    posttube: '#4ECDC4',
    messenger: '#7B68EE',
    commerce: '#F59E0B',
  },
  space: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px' },
  radius: { sm: '8px', md: '12px', lg: '16px', xl: '20px', full: '9999px' },
  type: { xs: '11px', sm: '13px', base: '14px', md: '16px', lg: '18px', xl: '22px', '2xl': '28px', '3xl': '36px' },
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
