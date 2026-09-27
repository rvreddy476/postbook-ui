import { describe, expect, test } from "bun:test";

import {
  BrandingValidationError,
  brandingFromChannel,
  channelPatch,
  fieldErrorsFromApi,
  isDirty,
  isHttpsUrl,
  moveLink,
  normalizeHandleInput,
  normalizeLinks,
  readApiError,
  suggestHandle,
  validateBranding,
  type ChannelBranding,
} from "../model";

const saved: ChannelBranding = {
  name: "Raghu makes things",
  handle: "raghu.makes",
  about: "Woodwork, mostly.",
  avatar_media_id: "a1",
  banner_media_id: "b1",
  links: [
    { title: "Shop", url: "https://shop.example.com" },
    { title: "Newsletter", url: "https://news.example.com/join" },
  ],
  contact_email: "hello@example.com",
  featured_post_id: "p1",
};

function axiosError(status: number, code: string, message: string, details?: unknown) {
  return { response: { status, data: { error: { code, message, details } } } };
}

describe("channelPatch", () => {
  test("an untouched draft sends nothing", () => {
    expect(channelPatch(saved, { ...saved })).toEqual({});
    expect(isDirty(saved, { ...saved })).toBe(false);
  });

  test("only the changed keys are sent", () => {
    expect(channelPatch(saved, { ...saved, name: "  Raghu builds things  " })).toEqual({ name: "Raghu builds things" });
    expect(channelPatch(saved, { ...saved, about: "Woodwork and a bit of metal." })).toEqual({ about: "Woodwork and a bit of metal." });
  });

  test("whitespace-only edits are not changes", () => {
    expect(channelPatch(saved, { ...saved, name: `  ${saved.name}  `, about: `${saved.about} ` })).toEqual({});
  });

  test("the handle is lowercased and stripped of a leading @", () => {
    expect(channelPatch(saved, { ...saved, handle: "@Raghu.Builds" })).toEqual({ handle: "raghu.builds" });
    expect(channelPatch(saved, { ...saved, handle: "RAGHU.MAKES" })).toEqual({});
  });

  test("removing the picture, banner or featured video sends null", () => {
    expect(channelPatch(saved, { ...saved, avatar_media_id: null })).toEqual({ avatar_media_id: null });
    expect(channelPatch(saved, { ...saved, banner_media_id: "" })).toEqual({ banner_media_id: null });
    expect(channelPatch(saved, { ...saved, featured_post_id: null })).toEqual({ featured_post_id: null });
  });

  test("a new image id is sent as is", () => {
    expect(channelPatch(saved, { ...saved, avatar_media_id: "a2", banner_media_id: "b2" })).toEqual({ avatar_media_id: "a2", banner_media_id: "b2" });
  });

  test("clearing the contact email sends an empty string", () => {
    expect(channelPatch(saved, { ...saved, contact_email: "   " })).toEqual({ contact_email: "" });
  });

  test("links are normalised: trimmed, empty rows dropped, order kept, whole list sent", () => {
    const after = {
      ...saved,
      links: [{ title: " Shop ", url: " https://shop.example.com " }, { title: "", url: "" }, { title: "Newsletter", url: "https://news.example.com/join" }],
    };
    expect(channelPatch(saved, after)).toEqual({});
    const reordered = { ...saved, links: [saved.links[1], saved.links[0]] };
    expect(channelPatch(saved, reordered)).toEqual({ links: [saved.links[1], saved.links[0]] });
  });

  test("an http link is refused before anything leaves the browser", () => {
    const after = { ...saved, links: [{ title: "Shop", url: "http://shop.example.com" }] };
    let caught: unknown;
    try {
      channelPatch(saved, after);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BrandingValidationError);
    expect((caught as BrandingValidationError).errors.linkRows?.[0]?.url).toContain("https://");
    expect(isDirty(saved, after)).toBe(true);
  });

  test("more than ten links is refused", () => {
    const links = Array.from({ length: 11 }, (_, i) => ({ title: `L${i}`, url: `https://l${i}.example.com` }));
    expect(() => channelPatch(saved, { ...saved, links })).toThrow(BrandingValidationError);
    expect(validateBranding({ ...saved, links }).links).toContain("10");
  });

  test("a link title over 40 characters and a missing title are row errors", () => {
    const errors = validateBranding({
      ...saved,
      links: [
        { title: "x".repeat(41), url: "https://a.example.com" },
        { title: "", url: "https://b.example.com" },
      ],
    });
    expect(errors.linkRows?.[0]?.title).toContain("40");
    expect(errors.linkRows?.[1]?.title).toBeTruthy();
  });

  test("name, handle, about and email limits mirror the server", () => {
    expect(validateBranding({ ...saved, name: "ab" }).name).toBeTruthy();
    expect(validateBranding({ ...saved, name: "x".repeat(41) }).name).toBeTruthy();
    expect(validateBranding({ ...saved, handle: "_bad" }).handle).toBeTruthy();
    expect(validateBranding({ ...saved, handle: "a..b" }).handle).toBeTruthy();
    expect(validateBranding({ ...saved, about: "x".repeat(201) }).about).toBeTruthy();
    expect(validateBranding({ ...saved, contact_email: "not-an-email" }).contact_email).toBeTruthy();
    expect(validateBranding(saved)).toEqual({});
  });
});

describe("brandingFromChannel", () => {
  test("reads the wire, falling back to description for about", () => {
    const b = brandingFromChannel({ name: "N", handle: "h.andle", description: "old field", avatar_media_id: "", links: null, contact_email: null });
    expect(b.about).toBe("old field");
    expect(b.avatar_media_id).toBeNull();
    expect(b.links).toEqual([]);
    expect(b.contact_email).toBe("");
    expect(brandingFromChannel({ about: "new", description: "old" }).about).toBe("new");
  });
});

describe("links helpers", () => {
  test("moveLink swaps neighbours and ignores the edges", () => {
    const l = ["a", "b", "c"];
    expect(moveLink(l, 1, "up")).toEqual(["b", "a", "c"]);
    expect(moveLink(l, 1, "down")).toEqual(["a", "c", "b"]);
    expect(moveLink(l, 0, "up")).toEqual(["a", "b", "c"]);
    expect(moveLink(l, 2, "down")).toEqual(["a", "b", "c"]);
    expect(moveLink(l, 5, "up")).toEqual(["a", "b", "c"]);
    expect(moveLink(l, 1, "up")).not.toBe(l);
  });

  test("normalizeLinks trims and drops empty rows", () => {
    expect(normalizeLinks([{ title: " a ", url: " https://a.example.com " }, { title: " ", url: "" }, null])).toEqual([{ title: "a", url: "https://a.example.com" }]);
  });

  test("isHttpsUrl", () => {
    expect(isHttpsUrl("https://example.com/x?y=1")).toBe(true);
    expect(isHttpsUrl("HTTPS://Example.com")).toBe(true);
    expect(isHttpsUrl("http://example.com")).toBe(false);
    expect(isHttpsUrl("https://localhost")).toBe(false);
    expect(isHttpsUrl("example.com")).toBe(false);
    expect(isHttpsUrl("https://")).toBe(false);
  });
});

describe("handles", () => {
  test("normalizeHandleInput keeps only what the server accepts", () => {
    expect(normalizeHandleInput("@Raghu Makes!")).toBe("raghumakes");
    expect(normalizeHandleInput("a.b_c")).toBe("a.b_c");
  });
  test("suggestHandle slugs free text like the server", () => {
    expect(suggestHandle("Raghu Makes Things")).toBe("raghu.makes.things");
    expect(suggestHandle("  --R--  ")).toBe("");
    expect(suggestHandle("rv_reddy")).toBe("rv.reddy");
  });
});

describe("server errors", () => {
  test("known codes land on their field", () => {
    expect(readApiError(axiosError(409, "HANDLE_TAKEN", "That handle is taken")).field).toBe("handle");
    expect(readApiError(axiosError(400, "INVALID_NAME", "name must be 3-40 chars")).field).toBe("name");
    expect(readApiError(axiosError(400, "INVALID_ABOUT", "too long")).field).toBe("about");
    expect(readApiError(axiosError(400, "INVALID_LINKS", "https only")).field).toBe("links");
    expect(readApiError(axiosError(400, "INVALID_CONTACT_EMAIL", "bad email")).field).toBe("contact_email");
    expect(readApiError(axiosError(400, "INVALID_FEATURED_POST", "not yours")).field).toBe("featured_post_id");
  });
  test("details.field and a field named in the message are honoured", () => {
    expect(readApiError(axiosError(400, "INVALID_REQUEST", "bad", { field: "banner_media_id" })).field).toBe("banner_media_id");
    expect(readApiError(axiosError(400, "INVALID_REQUEST", "Invalid avatar_media_id")).field).toBe("avatar_media_id");
  });
  test("anything else is a page-level message", () => {
    const r = fieldErrorsFromApi(axiosError(500, "INTERNAL_ERROR", "boom"));
    expect(r.errors).toEqual({});
    expect(r.pageMessage).toBe("boom");
    expect(fieldErrorsFromApi(new Error("offline")).pageMessage).toBe("Could not reach the server.");
    expect(fieldErrorsFromApi(axiosError(409, "HANDLE_TAKEN", "That handle is taken")).errors).toEqual({ handle: "That handle is taken" });
  });
});
