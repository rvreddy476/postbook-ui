import { describe, expect, test } from "bun:test";

import { contractFixture } from "@/features/posttube/credits/__tests__/contracts";
import { CREDIT_REQUESTS_PATH, creditNotificationCopy, creditNotificationHref, decodeNotificationPage } from "@/lib/notificationInbox";

/*
  The two video-credit notifications on the Activity page, against
  notification-service's golden inbox page (notifications_inbox_credits.json,
  a byte copy). The rows carry no body: they are drawn from title and type.
*/

const inbox = contractFixture("notifications_inbox_credits.json") as { data: Record<string, unknown>[] };

describe("credit notifications (notifications_inbox_credits.json)", () => {
  const { notifications, next_cursor } = decodeNotificationPage(inbox);
  const [request, accepted] = notifications;

  test("the rows carry no body; the page has no cursor", () => {
    for (const row of inbox.data) expect("body" in row).toBe(false);
    expect(notifications).toHaveLength(2);
    expect(next_cursor).toBeNull();
  });

  test("credit_request: the server's sentence, the web's second line, the requests page", () => {
    expect(request).toMatchObject({
      id: "6bb8bc56-62c7-540e-926b-087dfc6a5e35",
      type: "credit_request",
      title: "Call UserB credited you in a video",
      body: "Accept to show the video on your profile, or decline.",
      actor_name: "Call UserB",
      deep_link: "/credits/requests",
      is_read: false,
    });
    expect(request.deep_link).toBe(CREDIT_REQUESTS_PATH);
  });

  test("credit_accepted: the server's sentence (no actor: Someone), the video on /posttube", () => {
    expect(accepted).toMatchObject({
      type: "credit_accepted",
      title: "Someone accepted your credit",
      body: "The video now shows on their profile.",
      deep_link: "/posttube/watch/00000000-0000-4000-8000-0000000cd002",
    });
    expect(accepted.actor_name).toBeUndefined();
  });

  test("a credit request opens the requests page whatever link the row carries; no title falls back to the actor", () => {
    const [n] = decodeNotificationPage({ data: [{ ...inbox.data[0], deep_link: "/posttube/watch/p1", title: undefined }] }).notifications;
    expect(n.title).toBe("Call UserB credited you in a video");
    expect(n.deep_link).toBe(CREDIT_REQUESTS_PATH);
    expect(creditNotificationCopy("credit_request", undefined, undefined)?.title).toBe("Someone credited you in a video");
    expect(creditNotificationCopy("follow", "A", undefined)).toBeNull();
  });

  test("the bell menus route the same way", () => {
    expect(creditNotificationHref("credit_request", "/anything")).toBe(CREDIT_REQUESTS_PATH);
    expect(creditNotificationHref("credit_accepted", "/tube/watch/v1?t=3")).toBe("/posttube/watch/v1?t=3");
    expect(creditNotificationHref("credit_accepted", "/posttube/watch/v1")).toBe("/posttube/watch/v1");
    expect(creditNotificationHref("credit_accepted", undefined)).toBeUndefined();
    expect(creditNotificationHref("follow", "/u/x")).toBeUndefined();
  });
});
