import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/contexts/ToastContext";
import type { Relationship, UserProfile } from "@/types/profile";

/*
  The profile header's identity row (founder screenshot, 22 Oct 2026): the
  name never runs under the action buttons, nothing pushes the row wider
  than the page, there is no PostTube Channel card, and Follow reflects the
  relationship.
*/

mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }),
  usePathname: () => "/u/raghu",
  useSearchParams: () => new URLSearchParams(),
}));

const { ProfileHeader } = await import("../ProfileHeader");

const noop = () => {};

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "raghu",
  display_name: "Raghuvaran Nalabolu With A Very Long Display Name",
  bio: "",
  category: "personal",
  badge_flags: 0,
  is_verified: false,
  follower_count: 0,
  following_count: 0,
  friend_count: 0,
  post_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as unknown as UserProfile;

function rel(over: Partial<Relationship> = {}): Relationship {
  return {
    following: false, followed_by: false, blocked: false, blocked_by: false,
    can_dm: true, can_see_online: false, can_add_to_group: false, ...over,
  };
}

function render(relationship: Relationship | null, isOwn = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}><ToastProvider>
      <ProfileHeader
        profile={profile}
        links={[]}
        relationship={relationship}
        isOwn={isOwn}
        graphCounts={{ follower_count: 1, following_count: 2, friend_count: 0 }}
        onFollow={noop}
        onUnfollow={noop}
        onRemoveFromCircle={noop}
        onEditProfile={noop}
        signedIn
      />
    </ToastProvider></QueryClientProvider>,
  );
}

describe("profile header identity row", () => {
  test("no PostTube Channel card (it belongs to PostTube)", () => {
    const html = render(rel());
    expect(html).not.toContain("PostTube Channel");
    expect(html).not.toContain("Subscribers");
    expect(html).not.toContain("/posttube/channel/");
  });

  test("the name truncates instead of running under the buttons, and the actions wrap to their own row", () => {
    const html = render(rel());
    const h1 = html.match(/<h1[^>]*>/)?.[0] ?? "";
    expect(h1).toContain("truncate");
    expect(h1).toContain("max-w-full");
    expect(h1).not.toContain("whitespace-nowrap");
    expect(h1).toContain(`title="${profile.display_name}"`);
    // Stacked by default; side by side only when the column (not the
    // viewport) is wide enough.
    expect(html).toMatch(/class="@container [^"]*min-w-0/);
    const row = html.match(/<div data-testid="profile-identity-row" class="([^"]*)"/)?.[1] ?? "";
    expect(row.split(" ")).toContain("flex-col");
    expect(row.split(" ")).toContain("@3xl:flex-row");
  });

  test("the grid tracks may shrink, so a long name cannot widen the page", () => {
    const html = render(rel());
    expect(html).toContain("md:grid-cols-[auto_minmax(0,1fr)]");
    expect(html).not.toContain("md:grid-cols-[auto_1fr_auto]");
  });

  test("Follow button states follow the relationship", () => {
    // ("Following" alone also labels the count, so match the button.)
    expect(render(rel({ following: true }))).toContain('aria-label="Following @raghu. Unfollow"');
    expect(render(rel({ follow_request_status: "pending_sent" }))).toContain("Requested");
    expect(render(rel({ followed_by: true }))).toContain("Follow back");
    const plain = render(rel());
    expect(plain).toMatch(/aria-pressed="false"[^>]*>.*?Follow<\/button>/);
    expect(plain).not.toContain('aria-label="Following @raghu. Unfollow"');
    // A null relationship (the old keyless-graph failure) reads as Follow.
    expect(render(null)).not.toContain('aria-label="Following @raghu. Unfollow"');
  });
});
