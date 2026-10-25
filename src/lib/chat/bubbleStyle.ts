/*
  Bubble colour (user setting chat_bubble_style, CONTRACT §7): the colour of
  my outgoing bubbles in every chat. Values are the server's enum; colours
  are tokens in src/ui/theme.css, drawn by chat-bubbles.css.
*/

export const BUBBLE_STYLES = ['default', 'ocean', 'ember', 'forest', 'violet', 'mono'] as const
export type BubbleStyle = (typeof BUBBLE_STYLES)[number]

export const BUBBLE_STYLE_LABELS: Record<BubbleStyle, string> = {
  default: 'Classic',
  ocean: 'Ocean',
  ember: 'Ember',
  forest: 'Forest',
  violet: 'Violet',
  mono: 'Graphite',
}

export function parseBubbleStyle(v: unknown): BubbleStyle {
  return typeof v === 'string' && (BUBBLE_STYLES as readonly string[]).includes(v) ? (v as BubbleStyle) : 'default'
}

/** The class an outgoing bubble carries ("" for default, which keeps bg-primary-ink). */
export function bubbleClass(style: BubbleStyle): string {
  return style === 'default' ? '' : `chat-bubble--${style}`
}

/** The swatch class (always set, default included) for pickers. */
export function bubbleSwatchClass(style: BubbleStyle): string {
  return `chat-swatch--${style}`
}
