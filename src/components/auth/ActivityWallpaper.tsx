import {
  Camera,
  Film,
  Heart,
  MessageCircle,
  Mic,
  Music,
  Play,
  Send,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";

/*
  The sign-in wallpaper (founder, 23 Oct 2026: "a wallpaper that shows every
  activity of our app"), the web twin of Android's UsActivityWallpaper: a
  scattered doodle pattern of what VChat does, each glyph in one of the
  theme's accent colours at low strength. Server-rendered once from a seeded
  lattice, so it is the same on every load and never moves; behind the page,
  never focusable, never read by a screen reader.
*/

const GLYPHS: LucideIcon[] = [
  MessageCircle, Play, Heart, Camera, Music, ShoppingBag,
  Film, Send, Mic, Smile, Star, Sparkles,
];

/** Theme colour variables (space-separated RGB triples), cycled across glyphs. */
const TINTS = ["--brand-accent", "--success", "--warning", "--danger", "--info", "--send"];

const CELL = 72;
const GLYPH = 26;
const COLUMNS = 30;
const ROWS = 18;

/** Same hash as Android's wallpaperSeed, so both clients scatter alike. */
export function wallpaperSeed(row: number, column: number): number {
  let h = Math.imul(row, 73_856_093) ^ Math.imul(column, 19_349_663);
  h ^= h >>> 13;
  h = Math.imul(h, 1_540_483_477);
  h ^= h >>> 15;
  return h & 0x7fffffff;
}

export interface WallpaperCell {
  key: string;
  x: number;
  y: number;
  glyph: number;
  tint: number;
  angle: number;
}

/** The lattice, as data (tested): positions, glyph, tint and angle per cell. */
export function wallpaperCells(rows = ROWS, columns = COLUMNS): WallpaperCell[] {
  const cells: WallpaperCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const seed = wallpaperSeed(row, column);
      const stagger = row % 2 === 0 ? 0 : CELL / 2;
      const jx = ((seed % 5) - 2) * CELL * 0.08;
      const jy = ((Math.floor(seed / 5) % 5) - 2) * CELL * 0.08;
      cells.push({
        key: `${row}-${column}`,
        x: column * CELL + stagger + jx,
        y: row * CELL + jy,
        glyph: seed % GLYPHS.length,
        tint: Math.floor(seed / GLYPHS.length) % TINTS.length,
        angle: ((seed % 7) - 3) * 6,
      });
    }
  }
  return cells;
}

const CELLS = wallpaperCells();

export function ActivityWallpaper() {
  return (
    <div className="auth-wallpaper" aria-hidden="true">
      <svg width={COLUMNS * CELL} height={ROWS * CELL} focusable="false">
        {CELLS.map((c) => {
          const Glyph = GLYPHS[c.glyph];
          return (
            <g
              key={c.key}
              transform={`translate(${c.x - GLYPH / 2} ${c.y - GLYPH / 2}) rotate(${c.angle} ${GLYPH / 2} ${GLYPH / 2})`}
              style={{ color: `rgb(var(${TINTS[c.tint]}) / var(--auth-wallpaper-strength))` }}
            >
              <Glyph width={GLYPH} height={GLYPH} strokeWidth={1.75} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
