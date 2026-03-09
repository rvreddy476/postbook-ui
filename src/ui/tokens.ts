export const uiTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    md: 16,
    lg: 20,
    xl: 28,
  },
  blur: {
    soft: 14,
    medium: 16,
    strong: 18,
  },
  colors: {
    background: "#0B0B0F",
    text: "#FFFFFF",
    muted: "#9CA3AF",
  },
} as const;

export type UiTokens = typeof uiTokens;
