import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Relationship } from "@/types/profile";
import { ProfileActions } from "../ProfileActions";
import { ProfileCounts } from "../ProfileCounts";
import { ProfileSortControl } from "../ProfileSortControl";
import { visibleProfileTabKeys } from "../ProfileTabs";
import { PrivateProfileView } from "../states/PrivateProfileView";
import { BlockedProfileView } from "../states/BlockedProfileView";
import {
  followButtonState,
  formatProfileCount,
  profileMenuRows,
  profileShareUrl,
  profileViewState,
} from "../profileParity";

const noop = () => {};

function rel(over: Partial<Relationship> = {}): Relationship {
  return {
    following: false, followed_by: false, blocked: false, blocked_by: false,
    can_dm: true, can_see_online: false, can_add_to_group: false, ...over,
  };
}

const actionProps = {
  username: "maya",
  followState: "follow" as const,
  blocked: false,
  onFollow: noop, onUnfollow: noop, onEditProfile: noop, onShare: noop, onCopyLink: noop,
  onBlock: noop, onUnblock: noop, onMute: noop, onUnmute: noop, onReport: noop,
};

describe("profile ⋮ menu rows", () => {
  test("owner: no menu at all, so never Report on your own profile", () => {
    expect(profileMenuRows({ isOwn: true, signedIn: true, blocked: false, isMuted: false })).toEqual([]);
  });

  test("signed-in visitor: copy link, mute, block, report", () => {
    const rows = profileMenuRows({ isOwn: false, signedIn: true, blocked: false, isMuted: false });
    expect(rows.map((r) => r.key)).toEqual(["copy_link", "mute", "block", "report"]);
    expect(rows.filter((r) => r.destructive).map((r) => r.key)).toEqual(["block", "report"]);
  });

  test("a blocked account offers Unblock instead of Block, and no mute", () => {
    const rows = profileMenuRows({ isOwn: false, signedIn: true, blocked: true, isMuted: true });
    expect(rows.map((r) => r.key)).toEqual(["copy_link", "unblock", "report"]);
  });

  test("a muted account offers Unmute", () => {
    expect(profileMenuRows({ isOwn: false, signedIn: true, blocked: false, isMuted: true }).map((r) => r.key)).toContain("unmute");
  });

  test("signed out: copy link only", () => {
    expect(profileMenuRows({ isOwn: false, signedIn: false, blocked: false, isMuted: false }).map((r) => r.key)).toEqual(["copy_link"]);
  });
});

describe("ProfileActions", () => {
  test("owner renders Edit profile · Share · Settings and no menu", () => {
    const html = renderToStaticMarkup(<ProfileActions {...actionProps} isOwn signedIn defaultMenuOpen />);
    expect(html).toContain("Edit profile");
    expect(html).toContain('aria-label="Share profile"');
    expect(html).toContain('aria-label="Settings"');
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain('aria-label="More actions"');
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain("Report");
    expect(html).not.toContain("Follow");
  });

  test("visitor renders Follow · Message · Share · ⋮ with Block and Report in the menu", () => {
    const html = renderToStaticMarkup(
      <ProfileActions {...actionProps} isOwn={false} signedIn defaultMenuOpen messageSlot={<span data-slot="message">Message</span>} />,
    );
    const order = ["Follow", 'data-slot="message"', 'aria-label="Share profile"', 'aria-label="More actions"'].map((s) => html.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="true"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(4);
    for (const row of ["copy_link", "mute", "block", "report"]) expect(html).toContain(`data-row="${row}"`);
    expect(html).not.toContain("Edit profile");
  });

  test("the menu is closed until opened", () => {
    const html = renderToStaticMarkup(<ProfileActions {...actionProps} isOwn={false} signedIn />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"');
  });

  test("follow state labels: Following is a pressed toggle, Requested is inert", () => {
    const following = renderToStaticMarkup(<ProfileActions {...actionProps} isOwn={false} signedIn followState="following" />);
    expect(following).toContain('aria-pressed="true"');
    expect(following).toContain("Following");
    const requested = renderToStaticMarkup(<ProfileActions {...actionProps} isOwn={false} signedIn followState="requested" />);
    expect(requested).toMatch(/disabled=""[^>]*>.*Requested/s);
  });

  test("signed out: Follow goes to sign-in, the menu only copies the link", () => {
    const html = renderToStaticMarkup(
      <ProfileActions {...actionProps} isOwn={false} signedIn={false} signInHref="/login?next=%2Fu%2Fmaya" defaultMenuOpen />,
    );
    expect(html).toContain('href="/login?next=%2Fu%2Fmaya"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(1);
    expect(html).not.toContain('data-row="report"');
  });

  test("a blocked account hides Follow and Message", () => {
    const html = renderToStaticMarkup(
      <ProfileActions {...actionProps} isOwn={false} signedIn blocked defaultMenuOpen messageSlot={<span data-slot="message" />} />,
    );
    expect(html).not.toContain('data-slot="message"');
    expect(html).not.toContain(">Follow<");
    expect(html).toContain('data-row="unblock"');
  });
});

describe("follow button state", () => {
  test("following / requested / follow back / follow", () => {
    expect(followButtonState(null, rel({ following: true }))).toBe("following");
    expect(followButtonState({ follow_status: "following" }, null)).toBe("following");
    expect(followButtonState({ follow_status: "requested" }, rel())).toBe("requested");
    expect(followButtonState(null, rel({ follow_request_status: "pending_sent" }))).toBe("requested");
    expect(followButtonState(null, rel({ followed_by: true }))).toBe("follow_back");
    expect(followButtonState(null, rel())).toBe("follow");
  });
});

describe("profile view state", () => {
  const base = { isLoading: false, isOwn: false, relationship: null as Relationship | null };

  test("loading first", () => {
    expect(profileViewState({ ...base, isLoading: true, profile: null })).toBe("loading");
  });

  test("blocked by the account: a neutral not-found, the same as a missing account", () => {
    expect(profileViewState({ ...base, profile: {}, relationship: rel({ blocked_by: true }) })).toBe("not_found");
    expect(profileViewState({ ...base, profile: null, errorStatus: 404 })).toBe("not_found");
    expect(profileViewState({ ...base, profile: null })).toBe("not_found");
  });

  test("a server or network failure is an error with retry, not a not-found", () => {
    expect(profileViewState({ ...base, profile: null, errorStatus: 500 })).toBe("error");
    expect(profileViewState({ ...base, profile: null, errorStatus: 0 })).toBe("error");
  });

  test("blocked by the viewer: the unblock page", () => {
    expect(profileViewState({ ...base, profile: {}, relationship: rel({ blocked: true }) })).toBe("blocked_by_viewer");
  });

  test("private and not followed: the private notice; followed or own: the profile", () => {
    expect(profileViewState({ ...base, profile: { is_private: true }, relationship: rel() })).toBe("private");
    expect(profileViewState({ ...base, profile: { is_private: true, follow_status: "requested" }, relationship: rel() })).toBe("private");
    expect(profileViewState({ ...base, profile: { is_private: true }, relationship: rel({ following: true }) })).toBe("ready");
    expect(profileViewState({ ...base, profile: { is_private: true, follow_status: "following" }, relationship: null })).toBe("ready");
    expect(profileViewState({ ...base, isOwn: true, profile: { is_private: true }, relationship: null })).toBe("ready");
    expect(profileViewState({ ...base, profile: { is_private: false }, relationship: rel() })).toBe("ready");
  });
});

describe("private and blocked rendering", () => {
  test("private notice says the account is private and offers Follow", () => {
    const html = renderToStaticMarkup(
      <PrivateProfileView username="maya" signedIn followState="follow" onFollow={noop} />,
    );
    expect(html).toContain("This account is private");
    expect(html).toContain("Follow @maya to see their videos and reels.");
    expect(html).toMatch(/<button[^>]*>.*Follow<\/button>/s);
  });

  test("private notice after a request shows Requested, disabled", () => {
    const html = renderToStaticMarkup(
      <PrivateProfileView username="maya" signedIn followState="requested" onFollow={noop} />,
    );
    expect(html).toContain("Requested");
    expect(html).toContain('disabled=""');
  });

  test("private notice signed out: Follow goes to sign-in", () => {
    const html = renderToStaticMarkup(
      <PrivateProfileView username="maya" signedIn={false} followState="follow" onFollow={noop} signInHref="/login?next=x" />,
    );
    expect(html).toContain('href="/login?next=x"');
  });

  test("viewer-blocked page offers Unblock and shows no content", () => {
    const html = renderToStaticMarkup(
      <BlockedProfileView variant="blocked_by_viewer" username="maya" onUnblock={noop} onGoHome={noop} />,
    );
    expect(html).toContain("You have blocked @maya");
    expect(html).toContain("Unblock");
  });
});

describe("sort control, tabs, counts, share", () => {
  test("sort control is a radio group with one tab stop on the selected sort", () => {
    const html = renderToStaticMarkup(<ProfileSortControl value="popular" onChange={noop} subject="videos" />);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Sort videos"');
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-checked="true"[^>]*tabindex="0"[^>]*data-sort="popular"/);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
    for (const label of ["Latest", "Popular", "Oldest"]) expect(html).toContain(`>${label}</button>`);
  });

  test("Videos and Reels always show; Saved and Liked are the owner's only", () => {
    const visitor = visibleProfileTabKeys({ isOwn: false });
    expect(visitor).toContain("videos");
    expect(visitor).toContain("flicks");
    expect(visitor).not.toContain("stashed");
    expect(visitor).not.toContain("liked");
    const owner = visibleProfileTabKeys({ isOwn: true });
    expect(owner).toContain("stashed");
    expect(owner).toContain("liked");
  });

  test("counts render Following and Followers", () => {
    const html = renderToStaticMarkup(<ProfileCounts followerCount={1234} followingCount={1} />);
    expect(html).toContain('data-count="following">1<');
    expect(html).toContain('data-count="followers">1.2K<');
    expect(html).toContain("Followers");
    expect(html).not.toContain("Likes");
    // Not clickable unless the lists can be opened.
    expect(html).not.toContain("<button");
    expect(renderToStaticMarkup(<ProfileCounts followerCount={1} followingCount={0} onOpen={noop} />)).toContain("Follower<");
  });

  test("count formatting", () => {
    expect(formatProfileCount(0)).toBe("0");
    expect(formatProfileCount(999)).toBe("999");
    expect(formatProfileCount(1000)).toBe("1K");
    expect(formatProfileCount(2_500_000)).toBe("2.5M");
    expect(formatProfileCount(undefined)).toBe("0");
  });

  test("share URL is the public /u/<username> address", () => {
    expect(profileShareUrl("https://app.example/", { username: "maya", id: "id-1" })).toBe("https://app.example/u/maya");
    expect(profileShareUrl("https://app.example", { username: "", id: "id-1" })).toBe("https://app.example/u/id-1");
  });
});
