import { afterEach, describe, expect, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import api from "@/lib/api";
import TaxInfoForm, { TAX_LOCKED_LINE } from "@/components/monetization/TaxInfoForm";
import {
  PAYOUTS_AVAILABLE_KEY,
  TaxCollectionClosedError,
  postTaxInfo,
  postTaxProfile,
} from "@/hooks/useMonetization";
import PayoutsPage from "@/app/monetization/payouts/page";

/* Founder, 15 Oct: while payouts are off the payouts area collects no tax details. */

const spies: { mockRestore: () => void }[] = [];
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

function spyPost() {
  const spy = spyOn(api, "post").mockImplementation((async () => ({
    data: { data: { id: "t1", user_id: "u1", country: "IN", tax_data_encrypted: "{}" } },
  })) as never);
  spies.push(spy);
  return spy;
}

const TAX_INFO = { country: "IN", pan_number: "ABCDE1234F", gst_number: "" };
const TAX_PROFILE = { pan_encrypted: "ABCDE1234F", gstin: null, tax_residency: "IN" };

describe("tax requests are never sent while payouts are off", () => {
  test("payouts-page tax info: refused before any request", async () => {
    const post = spyPost();
    await expect(postTaxInfo(TAX_INFO, false)).rejects.toBeInstanceOf(TaxCollectionClosedError);
    expect(post).not.toHaveBeenCalled();
  });

  test("settings tax profile: refused before any request", async () => {
    const post = spyPost();
    await expect(postTaxProfile(TAX_PROFILE, false)).rejects.toBeInstanceOf(TaxCollectionClosedError);
    expect(post).not.toHaveBeenCalled();
  });

  test("with payouts open, both writes go through", async () => {
    const post = spyPost();
    await postTaxInfo(TAX_INFO, true);
    await postTaxProfile(TAX_PROFILE, true);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][0]).toBe("/v1/monetization/tax-info");
    expect(post.mock.calls[1][0]).toBe("/v1/monetization/tax-profile");
    expect(post.mock.calls[1][1]).toEqual(TAX_PROFILE);
  });
});

describe("tax form lock", () => {
  test("off: inputs and submit disabled, with the reason", () => {
    const html = renderToStaticMarkup(<TaxInfoForm onSubmit={() => {}} isPending={false} payoutsOff />);
    expect(html).toContain("<fieldset disabled");
    expect(html).toMatch(/type="submit" disabled=""/);
    expect(html).toContain(TAX_LOCKED_LINE);
    expect(TAX_LOCKED_LINE).toBe("Available when payouts open");
  });

  test("on: the form is live", () => {
    const html = renderToStaticMarkup(<TaxInfoForm onSubmit={() => {}} isPending={false} />);
    expect(html).not.toContain("<fieldset disabled");
    expect(html).not.toMatch(/type="submit" disabled/);
    expect(html).not.toContain(TAX_LOCKED_LINE);
  });
});

function renderPayouts(available: boolean | undefined) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (available !== undefined) qc.setQueryData(PAYOUTS_AVAILABLE_KEY, available);
  qc.setQueryData(["monetization-creator-ledger"], { balance: 500, currency: "INR", is_frozen: false });
  qc.setQueryData(["monetization-payout-methods"], [
    { id: "m1", user_id: "u1", method_type: "upi", details: { upi_id: "a@b" }, is_default: true, is_verified: true, created_at: "" },
  ]);
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <PayoutsPage />
    </QueryClientProvider>,
  );
}

function removeButton(html: string): string {
  const m = html.match(/<button[^>]*>(?:(?!<\/button>).)*Remove<\/button>/s);
  expect(m).not.toBeNull();
  return m![0];
}

describe("payouts page while off", () => {
  test("tax form locked, Add Method locked, remove a saved method still works", () => {
    for (const available of [false, undefined]) {
      const html = renderPayouts(available);
      expect(html).toContain(TAX_LOCKED_LINE);
      expect(html).toContain("<fieldset disabled");
      expect(html).toMatch(/<button disabled=""[^>]*>(?:(?!<\/button>).)*Add Method<\/button>/s);
      expect(removeButton(html)).not.toContain("disabled=\"\"");
    }
  });

  test("withdrawable=true: tax form enabled", () => {
    const html = renderPayouts(true);
    expect(html).not.toContain(TAX_LOCKED_LINE);
    expect(html).not.toContain("<fieldset disabled");
    expect(html).toContain("Save Tax Info");
    expect(removeButton(html)).not.toContain("disabled=\"\"");
  });
});
