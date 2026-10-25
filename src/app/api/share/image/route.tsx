import { ImageResponse } from "next/og";

import { FALLBACK_IMAGE_HEIGHT, FALLBACK_IMAGE_WIDTH, SHARE_SITE_NAME } from "@/features/share/siteMeta";

/*
  GET /api/share/image — the generic 1200×630 card a link preview shows
  when the content has no picture of its own, or when the public may not
  see it (features/share/siteMeta). Drawn here rather than shipped as a
  file so the colours stay the theme's (theme.css: canvas 243 246 250,
  brand text 15 20 25, brand ink 47 107 163) and nothing in /public has
  to be regenerated when they change. Static for a day on shared caches.
*/

export const dynamic = "force-static";
export const revalidate = 86400;

export function GET(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: 72,
          background: "linear-gradient(135deg, rgb(243,246,250) 0%, rgb(233,240,249) 100%)",
          color: "rgb(15,20,25)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 112,
            height: 112,
            borderRadius: 32,
            background: "rgb(47,107,163)",
            color: "rgb(255,255,255)",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            fontWeight: 700,
            marginBottom: 40,
          }}
        >
          C
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>{SHARE_SITE_NAME}</div>
        <div style={{ display: "flex", fontSize: 32, color: "rgb(83,100,113)", marginTop: 12 }}>Posts, reels, videos, channels and shops</div>
      </div>
    ),
    {
      width: FALLBACK_IMAGE_WIDTH,
      height: FALLBACK_IMAGE_HEIGHT,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800" },
    },
  );
}
