const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111111"/><path d="M18 18h10l5 22 7-22h10L38 48H27L18 18z" fill="#ffffff"/></svg>`;

export function GET() {
  return new Response(ICON, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
