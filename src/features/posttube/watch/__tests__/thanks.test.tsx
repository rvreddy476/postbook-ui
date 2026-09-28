import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ThanksSheet } from "../components/ThanksSheet";
import { WatchDetails } from "../components/WatchDetails";
import { DEFAULT_MIN_TIP_PAISE, formatPaise, normalizeSupport, parseCustomAmount, showThanks, thanksAmountPills, type CreatorSupport } from "../thanks";
import { thanksBody, thanksErrorMessage } from "../watchApi";

const noop = () => undefined;
const on: CreatorSupport = { tipsEnabled: true, minTipPaise: 1000, currency: "INR", membershipTiers: [] };

describe("thanksAmountPills: min, 2×, 5×, Custom from the server's minimum", () => {
  test("₹10 minimum → ₹10 · ₹20 · ₹50 · Custom", () => {
    expect(thanksAmountPills(1000)).toEqual([
      { paise: 1000, label: "₹10" },
      { paise: 2000, label: "₹20" },
      { paise: 5000, label: "₹50" },
      { paise: null, label: "Custom" },
    ]);
  });

  test("an odd minimum keeps its paise; missing / zero / negative falls back, never ₹0", () => {
    expect(thanksAmountPills(1250).map((p) => p.label)).toEqual(["₹12.50", "₹25", "₹62.50", "Custom"]);
    for (const bad of [0, -5, null, undefined, Number.NaN]) {
      expect(thanksAmountPills(bad)[0].paise).toBe(DEFAULT_MIN_TIP_PAISE);
    }
  });

  test("another currency is spelled out", () => {
    expect(formatPaise(500, "USD")).toBe("USD 5");
  });
});

describe("parseCustomAmount", () => {
  test("rupees with up to two decimals, the symbol and commas tolerated", () => {
    expect(parseCustomAmount("25", 1000)).toBe(2500);
    expect(parseCustomAmount("₹ 1,000.5", 1000)).toBe(100050);
  });

  test("under the minimum, not a number, three decimals or over the cap → null", () => {
    expect(parseCustomAmount("9.99", 1000)).toBeNull();
    expect(parseCustomAmount("abc", 1000)).toBeNull();
    expect(parseCustomAmount("10.005", 1000)).toBeNull();
    expect(parseCustomAmount("", 1000)).toBeNull();
    expect(parseCustomAmount("100001", 1000)).toBeNull();
  });
});

describe("rail presence: Thanks only when tips are on and the viewer is not the creator", () => {
  test("showThanks", () => {
    expect(showThanks(on, "viewer", "creator")).toBe(true);
    expect(showThanks(on, null, "creator")).toBe(true); // signed out: the click asks to sign in
    expect(showThanks(on, "creator", "creator")).toBe(false);
    expect(showThanks({ ...on, tipsEnabled: false }, "viewer", "creator")).toBe(false);
    expect(showThanks(null, "viewer", "creator")).toBe(false);
    expect(showThanks(on, "viewer", null)).toBe(false);
  });

  test("the creator row renders Thanks right after Follow only when onThanks is passed", () => {
    const base = {
      title: "t",
      authorId: "u1",
      channelName: "Ravi",
      channelHref: "/posttube/channel/ravi",
      followerCount: 0,
      viewCount: 0,
      publishedAt: "",
      source: "upload" as const,
      chapters: [],
      currentChapter: -1,
      onSeek: noop,
      description: "",
      hashtags: [],
      follow: (
        <button type="button" data-follow>
          Follow
        </button>
      ),
    };
    const without = renderToStaticMarkup(<WatchDetails {...base} />);
    expect(without).not.toContain('data-action="thanks"');
    const withThanks = renderToStaticMarkup(<WatchDetails {...base} onThanks={noop} />);
    const follow = withThanks.indexOf("data-follow");
    const thanks = withThanks.indexOf('data-action="thanks"');
    expect(follow).toBeGreaterThan(-1);
    expect(thanks).toBeGreaterThan(follow);
    expect(withThanks).toContain("Thanks</button>");
    expect(withThanks).not.toContain("Tip");
  });
});

describe("normalizeSupport", () => {
  test("reads the pinned shape", () => {
    expect(normalizeSupport({ tips_enabled: true, min_tip_paise: 2000, currency: "inr", membership_tiers: [{ id: "t1", name: "Gold", price_paise: 9900 }, { name: "no id" }] })).toEqual({
      tipsEnabled: true,
      minTipPaise: 2000,
      currency: "INR",
      membershipTiers: [{ id: "t1", name: "Gold", price_paise: 9900 }],
    });
  });

  test("malformed → tips off with the default minimum", () => {
    expect(normalizeSupport(null)).toEqual({ tipsEnabled: false, minTipPaise: DEFAULT_MIN_TIP_PAISE, currency: "INR", membershipTiers: [] });
    expect(normalizeSupport({ tips_enabled: "true" }).tipsEnabled).toBe(false);
  });
});

describe("thanksBody: the one place the tip body lives", () => {
  test("creator, post, amount and a trimmed message", () => {
    expect(thanksBody({ creatorId: "c1", postId: "p1", amountPaise: 2000, message: "  great  " })).toEqual({ creator_id: "c1", post_id: "p1", amount_paise: 2000, message: "great" });
  });

  test("post_id and message are left out when empty", () => {
    expect(thanksBody({ creatorId: "c1", amountPaise: 1000.4, message: "   " })).toEqual({ creator_id: "c1", amount_paise: 1000 });
  });
});

describe("thanksErrorMessage", () => {
  test("a 4xx carries the server's message; anything else is generic", () => {
    expect(thanksErrorMessage({ response: { status: 402, data: { error: { code: "CHARGE_FAILED", message: "charge failed: insufficient balance" } } } })).toBe("charge failed: insufficient balance");
    expect(thanksErrorMessage({ response: { status: 429, data: { error: "DAILY_TIP_CAP" } } })).toBe("DAILY_TIP_CAP");
    expect(thanksErrorMessage({ response: { status: 500, data: { error: { message: "boom" } } } })).toBe("Could not send your thanks. Try again.");
    expect(thanksErrorMessage(new Error("network"))).toBe("Could not send your thanks. Try again.");
  });
});

describe("ThanksSheet", () => {
  test("the confirm card with the four pills, the first chosen, and Send carrying the amount", () => {
    const html = renderToStaticMarkup(<ThanksSheet open channelName="Ravi" support={on} onSend={noop} onCancel={noop} />);
    expect(html).toContain("reel-confirm-card");
    expect(html).toContain("Thank Ravi");
    expect(html).toContain('role="radio" aria-checked="true" class="tube-thanks__pill" data-amount="1000">₹10<');
    expect(html).toContain('data-amount="2000">₹20<');
    expect(html).toContain('data-amount="5000">₹50<');
    expect(html).toContain('data-amount="custom">Custom<');
    expect(html).toContain("Send ₹10");
    expect(html).toContain('placeholder="Add a message (optional)"');
  });

  test("closed renders nothing", () => {
    expect(renderToStaticMarkup(<ThanksSheet open={false} channelName="Ravi" support={on} onSend={noop} onCancel={noop} />)).toBe("");
  });
});
