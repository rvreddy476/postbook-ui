import { describe, expect, test } from "bun:test";

import { GET } from "@/app/.well-known/assetlinks.json/route";

import { assetLinks, parseFingerprints } from "../assetlinks";

/* /.well-known/assetlinks.json from ANDROID_APP_LINK_FINGERPRINTS. */

const FP_A = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";
const FP_B = "11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00";

describe("parseFingerprints", () => {
  test("empty or missing is no target at all", () => {
    expect(parseFingerprints("")).toEqual([]);
    expect(parseFingerprints(undefined)).toEqual([]);
    expect(parseFingerprints(" , ,")).toEqual([]);
  });

  test("a bare fingerprint is the production package; package=fingerprint names a flavour", () => {
    expect(parseFingerprints(`${FP_A}, com.us.android.dev=${FP_B}`)).toEqual([
      { packageName: "com.us.android", fingerprints: [FP_A] },
      { packageName: "com.us.android.dev", fingerprints: [FP_B] },
    ]);
  });

  test("lower-case is upper-cased, duplicates folded, two certs for one package kept together", () => {
    expect(parseFingerprints(`${FP_A.toLowerCase()},${FP_A},com.us.android=${FP_B}`)).toEqual([{ packageName: "com.us.android", fingerprints: [FP_A, FP_B] }]);
  });

  test("a placeholder or malformed entry is dropped, never written", () => {
    expect(parseFingerprints("REPLACE_ME")).toEqual([]);
    expect(parseFingerprints("AA:BB")).toEqual([]);
    expect(parseFingerprints(`bad package=${FP_A}`)).toEqual([]);
    expect(parseFingerprints(`com.us.android=${FP_A.replace("AA", "GG")}`)).toEqual([]);
  });
});

describe("assetLinks", () => {
  test("one statement per package, handle_all_urls", () => {
    expect(assetLinks([{ packageName: "com.us.android", fingerprints: [FP_A] }, { packageName: "com.us.android.dev", fingerprints: [] }])).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "com.us.android", sha256_cert_fingerprints: [FP_A] },
      },
    ]);
    expect(assetLinks([])).toEqual([]);
  });
});

describe("GET /.well-known/assetlinks.json", () => {
  test("serves JSON from the environment, `[]` when it is empty", async () => {
    const was = process.env.ANDROID_APP_LINK_FINGERPRINTS;
    try {
      process.env.ANDROID_APP_LINK_FINGERPRINTS = "";
      const empty = GET();
      expect(empty.status).toBe(200);
      expect(empty.headers.get("content-type")).toContain("application/json");
      expect(await empty.json()).toEqual([]);

      process.env.ANDROID_APP_LINK_FINGERPRINTS = `com.us.android.dev=${FP_B}`;
      const body = (await GET().json()) as Array<{ target: { package_name: string; sha256_cert_fingerprints: string[] } }>;
      expect(body).toHaveLength(1);
      expect(body[0].target.package_name).toBe("com.us.android.dev");
      expect(body[0].target.sha256_cert_fingerprints).toEqual([FP_B]);
    } finally {
      if (was === undefined) delete process.env.ANDROID_APP_LINK_FINGERPRINTS;
      else process.env.ANDROID_APP_LINK_FINGERPRINTS = was;
    }
  });
});
