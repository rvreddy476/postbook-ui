import { assetLinks, parseFingerprints } from "@/features/share/assetlinks";

/*
  GET /.well-known/assetlinks.json

  Android's App Links verifier fetches this (no cookies, no redirects
  allowed) to confirm cleestudio.com trusts the app whose signing
  certificate it names. The fingerprints come from the environment
  (ANDROID_APP_LINK_FINGERPRINTS, see .env.example); with none set the
  answer is `[]`. Served as application/json with a short public cache:
  the verifier re-reads on install and on a schedule, never per tap.
*/

export const dynamic = "force-dynamic";

export function GET(): Response {
  const body = assetLinks(parseFingerprints(process.env.ANDROID_APP_LINK_FINGERPRINTS));
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
