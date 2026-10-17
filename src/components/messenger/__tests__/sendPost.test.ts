import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ChatApiError, postMessageBody, sendPostMessage } from "@/services/messageService";
import { conversationIdOf, sendPostErrorText, sendPostToUser } from "../sendPost";

/*
  "Send in Messages" (audit T-25). The request body is exactly what
  message-service's SendMessageRequest binds ({type:"post", post_id, text?}),
  the conversation is opened the way the messenger opens one, and the
  server's refusals come back as words — above all the 422 for a post as the
  first message of a message request.
*/

const realFetch = globalThis.fetch;
// Another suite may leave a bare `window` behind; the chat client then reads
// localStorage for the session, so give it an empty one for these tests.
const g = globalThis as { localStorage?: unknown };
let hadStorage = false;
let realStorage: unknown;
beforeEach(() => {
  hadStorage = "localStorage" in g;
  realStorage = g.localStorage;
  if (!hadStorage) g.localStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (!hadStorage) delete g.localStorage;
  else g.localStorage = realStorage;
});

type Call = { url: string; init?: RequestInit };

function mockFetch(handler: (url: string, init?: RequestInit) => Response): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the post message body", () => {
  test("is {type:'post', post_id} with no caption, and carries text only when there is one", () => {
    expect(postMessageBody("p1")).toEqual({ type: "post", post_id: "p1" });
    expect(postMessageBody("p1", "   ")).toEqual({ type: "post", post_id: "p1" });
    expect(postMessageBody("p1", "  look at this ")).toEqual({ type: "post", post_id: "p1", text: "look at this" });
    // Never a media_id: the server refuses one on a post.
    expect("media_id" in postMessageBody("p1", "x")).toBe(false);
  });

  test("sendPostMessage POSTs that body to the conversation's messages", async () => {
    const calls = mockFetch((url) =>
      url.startsWith("/api/chat/")
        ? json(200, { data: { msg_id: "m1", type: "post", post_id: "p1", sender_id: "me", conversation_id: "c1", created_at: "2026-10-14T00:00:00Z" } })
        : json(401, {}),
    );
    const res = await sendPostMessage("c1", "p1", "hi");
    const chat = calls.filter((c) => c.url.startsWith("/api/chat/"));
    expect(chat).toHaveLength(1);
    expect(chat[0].url).toBe("/api/chat/conversations/c1/messages");
    expect(chat[0].init?.method).toBe("POST");
    expect(JSON.parse(String(chat[0].init?.body))).toEqual({ type: "post", post_id: "p1", text: "hi" });
    // The reply is normalised like any message, post_id kept.
    expect(res.data?.type).toBe("post");
    expect(res.data?.post_id).toBe("p1");
  });

  test("a 422 INVALID_REQUEST_MESSAGE arrives as a ChatApiError with its status and code", async () => {
    mockFetch((url) =>
      url.startsWith("/api/chat/")
        ? json(422, { error: { code: "INVALID_REQUEST_MESSAGE", message: "message request first message is invalid: posts are not allowed until the request is accepted" } })
        : json(401, {}),
    );
    const err = await sendPostMessage("c1", "p1").catch((e) => e);
    expect(err).toBeInstanceOf(ChatApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(422);
    expect(err.code).toBe("INVALID_REQUEST_MESSAGE");
    // Existing callers read .message: it is still the server's text.
    expect(err.message).toContain("posts are not allowed");
  });
});

describe("sendPostToUser", () => {
  test("opens the direct conversation the messenger's way, then sends the post into it", async () => {
    const steps: string[] = [];
    const id = await sendPostToUser("u2", "p1", " nice ", {
      openDirect: async (userId) => {
        steps.push(`open ${userId}`);
        // Go's zero values: an empty id first must not win.
        return { data: { conversation_id: "", id: "c9" } };
      },
      send: async (conversationId, postId, caption) => {
        steps.push(`send ${conversationId} ${postId} ${caption}`);
      },
    });
    expect(id).toBe("c9");
    expect(steps).toEqual(["open u2", "send c9 p1 nice"]);
  });

  test("an empty caption is sent as none", async () => {
    let got: string | undefined = "unset";
    await sendPostToUser("u2", "p1", "  ", {
      openDirect: async () => ({ conversation_id: "c1" }),
      send: async (_c, _p, caption) => {
        got = caption;
      },
    });
    expect(got).toBeUndefined();
  });

  test("no conversation id → nothing is sent", async () => {
    let sent = false;
    const err = await sendPostToUser("u2", "p1", undefined, {
      openDirect: async () => ({ data: {} }),
      send: async () => {
        sent = true;
      },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(sent).toBe(false);
  });

  test("conversationIdOf takes the first non-empty candidate", () => {
    expect(conversationIdOf({ data: { conversation_id: "a" } })).toBe("a");
    expect(conversationIdOf({ data: { conversation_id: "", id: "b" } })).toBe("b");
    expect(conversationIdOf({ conversation_id: "c" })).toBe("c");
    expect(conversationIdOf({ id: "" })).toBeNull();
    expect(conversationIdOf(null)).toBeNull();
  });
});

describe("what a refused share says", () => {
  test("422: a post cannot start a message request — said plainly, with the way forward", () => {
    const text = sendPostErrorText(new ChatApiError("x", 422, "INVALID_REQUEST_MESSAGE"), "Asha Rao");
    expect(text).toBe("A post can't start a message request. Send Asha a message first — you can share posts once they accept.");
  });

  test("409 awaiting acceptance, 403 not allowed, 429 rate limited, and anything else", () => {
    expect(sendPostErrorText(new ChatApiError("x", 409, "AWAITING_REQUEST_ACCEPTANCE"), "Asha")).toBe(
      "Asha hasn't accepted your message request yet. You can share posts once they do.",
    );
    expect(sendPostErrorText(new ChatApiError("x", 403, "MESSAGING_NOT_ALLOWED"), "Asha")).toBe("Asha isn't accepting messages from you.");
    expect(sendPostErrorText(new ChatApiError("x", 429, "RATE_LIMITED"), "Asha")).toBe("You're sending too fast. Wait a moment and try again.");
    expect(sendPostErrorText(new Error("network down"), "Asha")).toBe("Couldn't send the post. Try again.");
    // A 409 that is not about a request (an idempotency clash) is not mistaken for one.
    expect(sendPostErrorText(new ChatApiError("x", 409, "IDEMPOTENCY_KEY_CONFLICT"), "Asha")).toBe("Couldn't send the post. Try again.");
  });

  test("an unnamed recipient still reads as a sentence", () => {
    expect(sendPostErrorText(new ChatApiError("x", 403, ""), "")).toBe("This person isn't accepting messages from you.");
    expect(sendPostErrorText(new ChatApiError("x", 409, "AWAITING_REQUEST_ACCEPTANCE"))).toBe(
      "They haven't accepted your message request yet. You can share posts once they do.",
    );
    expect(sendPostErrorText(new ChatApiError("x", 422, "INVALID_REQUEST_MESSAGE"))).toContain("Send them a message first");
  });
});

describe("where Send in Messages is offered", () => {
  const read = (p: string) => require("node:fs").readFileSync(require("node:path").resolve(import.meta.dir, p), "utf8") as string;

  test("both share surfaces open the messenger's own picker in share mode, for signed-in viewers only", () => {
    const sheet = read("../../../features/reels/components/ShareSheet.tsx");
    const dialog = read("../../ShareDialog.tsx");
    const panel = read("../SendInMessagesPanel.tsx");
    for (const src of [sheet, dialog]) {
      expect(src).toContain("useCanSendInMessages(postId)");
      expect(src).toContain("<SendInMessagesPanel");
      expect(src).toContain("Send in Messages");
    }
    expect(panel).toContain("<NewMessageSheet sharePostId={postId}");
    expect(panel).toContain("getSession()?.id");
  });

  test("the reels share sheet passes the reel's id; a channel's share does not offer it", () => {
    expect(read("../../../features/reels/components/ReelsScreen.tsx")).toContain("postId={active.id} />");
    expect(read("../../../features/posttube/channel/components/ChannelScreen.tsx")).not.toContain("postId=");
  });

  test("the plain New message path is unchanged; share mode commits through sendPostToUser", () => {
    const sheet = read("../NewMessageSheet.tsx");
    // Share mode commits through sendPostToUser; the plain path is unchanged.
    expect(sheet).toContain("await sendPostToUser(recipient.id, sharePostId, text)");
    expect(sheet).toContain("if (text.trim()) await sendMessage(conversationId, text.trim());");
  });
});
