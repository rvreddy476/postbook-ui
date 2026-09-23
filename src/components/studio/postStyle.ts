/**
 * The shape of a styled post, and the presets that produce one.
 *
 * All of it rides in the post's `rich_text` column, which post-service stores
 * as `json.RawMessage` — arbitrary JSON, canonicalised into the create
 * fingerprint and handed back on read. So nothing here needs a backend
 * change; the column was already general, the web was only ever putting
 * `{background, text_color}` in it.
 *
 * The document is stored as TipTap JSON, never as HTML. HTML from the server
 * has to be either trusted or sanitised, and a post body is written by
 * somebody else by definition. A JSON document is rendered here through a
 * whitelist of nodes and marks (see RichTextRenderer), so a field that does
 * not appear in that whitelist cannot reach the DOM at all.
 */

export type PostAlign = 'left' | 'center';
export type PostVerticalAlign = 'top' | 'middle';

/** A TipTap/ProseMirror document node, as stored. Deliberately loose here — RichTextRenderer is what decides which of it is allowed to render. */
export interface RichNode {
  type?: string;
  text?: string;
  content?: RichNode[];
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}

export interface PostRichText {
  /** Card background: a hex colour, or absent for the ordinary card. */
  background?: string;
  text_color?: string;
  /** Horizontal alignment of the body. */
  align?: PostAlign;
  /** Where the body sits when the card is taller than the text. */
  valign?: PostVerticalAlign;
  /** Preset id, kept so the composer can reopen on the template you chose. */
  template?: string;
  /** A background IMAGE behind the words, uploaded by the author. */
  background_media_id?: string;
  /** Scales the body. 1 is the card's normal size. */
  scale?: number;
  /** Rich body, TipTap JSON. Present on a Journal post; absent on a plain one. */
  format?: 'tiptap';
  doc?: RichNode;
}

export interface PostTemplate {
  id: string;
  label: string;
  /** Everything a template sets. `background_media_id` is never preset — that one is always the author's own upload. */
  style: Omit<PostRichText, 'format' | 'doc' | 'background_media_id' | 'template'>;
}

/**
 * The presets.
 *
 * Colours are literal hex rather than theme tokens on purpose: a styled post
 * keeps its appearance for every reader, in either theme, exactly as the
 * author saw it when they chose it — the value is stored on the post and must
 * not shift when the product's palette does. This is the one deliberate
 * exception to colour living in src/ui/theme.css, and it is why these values
 * live in one file of their own rather than being scattered through the
 * composer.
 */
export const POST_TEMPLATES: PostTemplate[] = [
  {
    id: 'plain',
    label: 'Plain',
    style: { align: 'left', valign: 'top', scale: 1 },
  },
  {
    id: 'quote',
    label: 'Quote',
    style: { background: '#101828', text_color: '#FFFFFF', align: 'center', valign: 'middle', scale: 1.5 },
  },
  {
    id: 'note',
    label: 'Note',
    style: { background: '#FFF7E6', text_color: '#5A3E00', align: 'left', valign: 'top', scale: 1.15 },
  },
  {
    id: 'announce',
    label: 'Announce',
    style: { background: '#2F6BA3', text_color: '#FFFFFF', align: 'center', valign: 'middle', scale: 1.4 },
  },
  {
    id: 'bold',
    label: 'Bold',
    style: { background: '#BE3262', text_color: '#FFFFFF', align: 'center', valign: 'middle', scale: 1.6 },
  },
  {
    id: 'calm',
    label: 'Calm',
    style: { background: '#E8F3EE', text_color: '#12513A', align: 'center', valign: 'middle', scale: 1.3 },
  },
];

export const DEFAULT_TEMPLATE = POST_TEMPLATES[0];

export const templateById = (id: string | undefined): PostTemplate =>
  POST_TEMPLATES.find((t) => t.id === id) ?? DEFAULT_TEMPLATE;

/**
 * Is this styled at all, or is it an ordinary post?
 *
 * A post with media is never styled: a background behind a photo grid is
 * noise, and the composer disables the picker in that case, so a stored style
 * that arrives alongside media is ignored rather than honoured.
 */
export const isStyled = (rich: PostRichText | null | undefined, hasMedia: boolean): boolean =>
  !hasMedia && Boolean(rich && (rich.background || rich.background_media_id || (rich.scale ?? 1) !== 1));

/**
 * Readable text over an arbitrary background image.
 *
 * With a photo behind the words, the author's chosen text colour is not
 * enough on its own — a white caption vanishes over a white sky. A scrim
 * between image and text is what makes it legible whatever the image is.
 */
export const scrimFor = (textColor: string | undefined): string =>
  (textColor ?? '#FFFFFF').toUpperCase() === '#FFFFFF' ||
  (textColor ?? '').toLowerCase() === 'white'
    ? 'rgba(0,0,0,0.42)'
    : 'rgba(255,255,255,0.45)';
