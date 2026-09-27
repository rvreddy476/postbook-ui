import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BrandingScreen } from "../BrandingScreen";
import type { ChannelBranding } from "../model";
import type { BrandingScreenProps, VideoRow } from "../view";

const noop = () => undefined;

/** Whether the one Save button in the sticky bar is disabled. */
function saveDisabled(html: string): boolean {
  const tag = html.match(/<button data-save-action="true"[^>]*>/)?.[0];
  if (!tag) throw new Error("no Save button rendered");
  return tag.includes('disabled=""');
}

const draft: ChannelBranding = {
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
  featured_post_id: "p2",
};

const videos: VideoRow[] = [
  { id: "p1", title: "Dovetails by hand", thumbnail_url: "https://cdn.example.com/p1.jpg", duration_seconds: 754, published_at: "2026-09-01T10:00:00Z", view_count: 1520 },
  { id: "p2", title: "A bench in a weekend", thumbnail_url: "https://cdn.example.com/p2.jpg", duration_seconds: 3725, published_at: "2026-08-20T10:00:00Z", view_count: 12_400 },
];

function loaded(overrides: Partial<Extract<BrandingScreenProps, { kind: "loaded" }>> = {}): BrandingScreenProps {
  return {
    kind: "loaded",
    activeSection: "links",
    identity: {
      draft,
      errors: {},
      avatarUrl: "https://cdn.example.com/a1.jpg",
      bannerUrl: "https://cdn.example.com/b1.jpg",
      uploading: { avatar: false, banner: false },
      availability: { state: "idle" },
      onChange: noop,
      onPickAvatar: noop,
      onRemoveAvatar: noop,
      onPickBanner: noop,
      onRemoveBanner: noop,
    },
    links: {
      links: draft.links,
      contactEmail: draft.contact_email,
      errors: {},
      onLinkChange: noop,
      onAddLink: noop,
      onRemoveLink: noop,
      onMoveLink: noop,
      onContactEmailChange: noop,
    },
    featured: {
      selectedId: "p2",
      selected: videos[1],
      videos,
      query: "",
      onQuery: noop,
      loading: false,
      hasMore: false,
      onMore: noop,
      onSelect: noop,
    },
    save: { dirty: false, saving: false, changeCount: 0, errorCount: 0, onSave: noop, onReset: noop },
    ...overrides,
  };
}

describe("Branding page, no channel yet", () => {
  test("offers creation with the prefilled name and handle, and the monetization link", () => {
    const html = renderToStaticMarkup(
      <BrandingScreen
        kind="no-channel"
        create={{
          name: "Raghu makes things",
          handle: "raghu.makes",
          availability: { state: "available" },
          errors: {},
          creating: false,
          onChange: noop,
          onCreate: noop,
        }}
      />,
    );
    expect(html).toContain("Branding");
    expect(html).toContain("Create your channel");
    expect(html).toContain('value="Raghu makes things"');
    expect(html).toContain('value="raghu.makes"');
    expect(html).toContain("@raghu.makes is free");
    expect(html).toContain('href="/monetization"');
    expect(html).not.toContain("data-save-bar");
    expect(html).not.toContain('id="featured"');
  });

  test("a taken handle disables Create and says so", () => {
    const html = renderToStaticMarkup(
      <BrandingScreen
        kind="no-channel"
        create={{ name: "N", handle: "taken.one", availability: { state: "taken", suggestion: "taken.one2" }, errors: {}, creating: false, onChange: noop, onCreate: noop }}
      />,
    );
    expect(html).toContain("@taken.one is taken");
    expect(html).toContain("try @taken.one2");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Create channel/);
  });
});

describe("Branding page, loaded", () => {
  test("three sections on one page, the nav marks the active one, Monetization is a link card", () => {
    const html = renderToStaticMarkup(<BrandingScreen {...loaded()} />);
    expect(html).toContain('id="identity"');
    expect(html).toContain('id="links"');
    expect(html).toContain('id="featured"');
    expect(html).toContain('href="#links" aria-current="location"');
    expect(html).not.toContain('href="#identity" aria-current');
    expect(html).toContain("data-monetization-card");
    expect(html).toContain('href="/monetization"');
    // What was removed stays removed.
    expect(html).not.toContain("Watermark");
    expect(html).not.toContain("Privacy");
    expect(html).not.toContain("Advanced");
  });

  test("identity fields carry the draft and the banner strip is 3:1", () => {
    const html = renderToStaticMarkup(<BrandingScreen {...loaded()} />);
    expect(html).toContain('value="Raghu makes things"');
    expect(html).toContain('value="raghu.makes"');
    expect(html).toContain("Woodwork, mostly.");
    expect(html).toContain("aspect-ratio:3 / 1");
    expect(html).toContain('src="https://cdn.example.com/b1.jpg"');
    expect(html).toContain("Remove banner");
    expect(html).toContain("Replace picture");
  });

  test("links render in order with move controls, the first cannot move up and the last cannot move down", () => {
    const html = renderToStaticMarkup(<BrandingScreen {...loaded()} />);
    expect(html.indexOf('value="Shop"')).toBeLessThan(html.indexOf('value="Newsletter"'));
    expect(html).toMatch(/aria-label="Move link 1 up"[^>]*disabled=""/);
    expect(html).not.toMatch(/aria-label="Move link 1 down"[^>]*disabled=""/);
    expect(html).toMatch(/aria-label="Move link 2 down"[^>]*disabled=""/);
    expect(html).toContain('value="hello@example.com"');
    expect(html).toContain("2/10");
  });

  test("the featured pick is shown and marked in the list", () => {
    const html = renderToStaticMarkup(<BrandingScreen {...loaded()} />);
    expect(html).toContain("data-featured-selected");
    expect(html).toContain("A bench in a weekend");
    expect(html).toContain("1:02:05");
    expect(html).toContain("12.4K views");
    expect(html).toMatch(/aria-pressed="true"[^>]*>[\s\S]*?A bench in a weekend/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>[\s\S]*?Dovetails by hand/);
  });

  test("Save is disabled until something changes, then counts the changes", () => {
    const rest = renderToStaticMarkup(<BrandingScreen {...loaded()} />);
    expect(rest).toContain("No changes");
    expect(saveDisabled(rest)).toBe(true);

    const dirty = renderToStaticMarkup(<BrandingScreen {...loaded({ save: { dirty: true, saving: false, changeCount: 2, errorCount: 0, onSave: noop, onReset: noop } })} />);
    expect(dirty).toContain("2 changes");
    expect(saveDisabled(dirty)).toBe(false);
  });

  test("field errors from the server sit under their field and block Save", () => {
    const props = loaded({ save: { dirty: true, saving: false, changeCount: 1, errorCount: 1, onSave: noop, onReset: noop } });
    if (props.kind === "loaded") props.identity = { ...props.identity, errors: { handle: "That handle is taken" } };
    const html = renderToStaticMarkup(<BrandingScreen {...props} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("That handle is taken");
    expect(html).toContain("1 field needs attention");
    expect(saveDisabled(html)).toBe(true);
  });

  test("link row errors mark the row", () => {
    const props = loaded();
    if (props.kind === "loaded") props.links = { ...props.links, errors: { links: "Fix the links marked below.", linkRows: { 1: { url: "Links must start with https://" } } } };
    const html = renderToStaticMarkup(<BrandingScreen {...props} />);
    expect(html).toContain("Links must start with https://");
    expect(html).not.toContain("Fix the links marked below.");
  });
});
