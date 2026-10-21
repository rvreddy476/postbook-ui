/*
  /.well-known/assetlinks.json — the Digital Asset Links statement Android
  reads to verify this site's App Links (the manifest's autoVerify intent
  filters on cleestudio.com). Pure, so it is unit-tested.

  ANDROID_APP_LINK_FINGERPRINTS lists the signing certificates, comma-separated:

      AA:BB:...:FF                      the production package (com.us.android)
      com.us.android.dev=AA:BB:...:FF   a named package (the dev or staging flavour)

  Empty → `[]`: the file is served, but it names no app, so nothing verifies
  and the chooser still opens. A placeholder fingerprint is never written.
*/

import { DEFAULT_ANDROID_PACKAGE } from "./shareRef";

const FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

export interface AppLinkTarget {
  packageName: string;
  fingerprints: string[];
}

/**
 * The targets an env value names, one per package, fingerprints upper-cased
 * and de-duplicated, in the order first seen. Entries that are not a
 * fingerprint are dropped, never written as they are.
 */
export function parseFingerprints(env: string | null | undefined, defaultPackage = DEFAULT_ANDROID_PACKAGE): AppLinkTarget[] {
  const byPackage = new Map<string, string[]>();
  for (const raw of (env ?? "").split(",")) {
    const item = raw.trim();
    if (!item) continue;
    const eq = item.indexOf("=");
    const pkg = eq >= 0 ? item.slice(0, eq).trim() : defaultPackage;
    const fp = (eq >= 0 ? item.slice(eq + 1) : item).trim().toUpperCase();
    if (!PACKAGE_RE.test(pkg) || !FINGERPRINT_RE.test(fp)) continue;
    const list = byPackage.get(pkg) ?? [];
    if (!list.includes(fp)) list.push(fp);
    byPackage.set(pkg, list);
  }
  return [...byPackage.entries()].map(([packageName, fingerprints]) => ({ packageName, fingerprints }));
}

export interface AssetLinkStatement {
  relation: string[];
  target: { namespace: "android_app"; package_name: string; sha256_cert_fingerprints: string[] };
}

/** The statement list: one entry per package, `[]` when there are no fingerprints. */
export function assetLinks(targets: readonly AppLinkTarget[]): AssetLinkStatement[] {
  return targets
    .filter((t) => t.fingerprints.length > 0)
    .map((t) => ({
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: t.packageName, sha256_cert_fingerprints: [...t.fingerprints] },
    }));
}
