import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CreditsBlock } from "../components/CreditsBlock";
import { CreditRequestsList } from "../components/CreditRequests";
import { CreditsEditor, linkedNote } from "../components/CreditsEditor";
import { creditsErrorProblem, creditsFormFrom, decodeCreditRequestsPage, decodeCreditsInfo, decodeGenres, EMPTY_CREDITS_FORM } from "../creditsModel";
import { contractData, contractFixture } from "./contracts";

/* The credits UI drawn from the server's golden fixtures (./contracts). */

const genres = decodeGenres((contractFixture("genres.json") as { data: unknown }).data);

describe("watch page Credits block", () => {
  const viewer = decodeCreditsInfo(contractData("post_detail_viewer.json"));

  test("meta line, roles grouped, a plain name searches, the accepted ones show an avatar and open the channel", () => {
    const html = renderToStaticMarkup(<CreditsBlock info={viewer} genres={genres} />);
    expect(html).toContain("Drama, Romance · 2024 · Blue Hour Films");
    expect(html).toContain("Cast:");
    expect(html).toContain("Director:");
    expect(html).toContain("Cinematographer:");
    expect(html).toContain('href="/posttube/search?q=Ravi%20Kumar"');
    expect(html).toContain('href="/posttube/channel/asha"');
    expect(html).toContain('href="/posttube/channel/kiran"');
    expect(html.match(/data-linked/g)).toHaveLength(2);
    expect(html).not.toContain("Remove me");
  });

  test("credits absent (a list row, or Go zero values): nothing drawn, not even a heading", () => {
    expect(renderToStaticMarkup(<CreditsBlock info={decodeCreditsInfo({})} />)).toBe("");
    expect(renderToStaticMarkup(<CreditsBlock info={decodeCreditsInfo({ credits: [], genres: [], release_year: 0, production_house: "" })} />)).toBe("");
    expect(renderToStaticMarkup(<CreditsBlock info={decodeCreditsInfo({ credits: null, genres: null })} />)).toBe("");
  });

  test("an appearances row (no credits) draws only its meta line", () => {
    const row = (contractFixture("appearances.json") as { data: unknown[] }).data[0];
    const html = renderToStaticMarkup(<CreditsBlock info={decodeCreditsInfo(row)} genres={genres} />);
    expect(html).toContain("Drama, Romance · 2024 · Blue Hour Films");
    expect(html).not.toContain("tube-credits__groups");
  });

  test("the credited person can remove themself; the owner sees pending and declined", () => {
    const mine = renderToStaticMarkup(<CreditsBlock info={viewer} viewerId="d3333333-3333-4333-8333-333333333333" onRemoveMe={() => undefined} />);
    expect(mine).toContain("Remove me");
    expect(mine).toContain('aria-label="Remove me from this video (Director)"');
    const owner = renderToStaticMarkup(<CreditsBlock info={decodeCreditsInfo(contractData("post_detail_owner.json"))} isOwner />);
    expect(owner).toContain("(pending)");
    expect(owner).toContain("(declined)");
    // A pending tag is still a plain name for the owner on the watch page.
    expect(owner.match(/data-linked/g)).toHaveLength(2);
  });
});

describe("credits editor", () => {
  test("empty: the hint, Add, genres, year and production house", () => {
    const html = renderToStaticMarkup(<CreditsEditor value={EMPTY_CREDITS_FORM} onChange={() => undefined} genres={genres} variant="upload" idPrefix="upload" />);
    expect(html).toContain("Add a credit");
    expect(html).toContain("0/30");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('id="upload-releaseYear"');
    expect(html).toContain('id="upload-productionHouse"');
    expect(html).toContain("upload-input");
    // The suggested roles feed the role combobox.
    expect(html).toContain('value="Cinematographer"');
  });

  test("the Hub shows each saved tag's status; a fresh link says it will be asked", () => {
    const form = creditsFormFrom(decodeCreditsInfo(contractData("post_detail_owner.json")));
    const html = renderToStaticMarkup(<CreditsEditor value={form} onChange={() => undefined} genres={[]} variant="hub" showStatus />);
    expect(html).toContain("Accepted");
    expect(html).toContain("Pending");
    expect(html).toContain("Declined");
    expect(html).toContain("hub-input");
    expect(html).toContain('aria-label="Move Asha Rao up"');
    expect(html).toContain('aria-label="Remove Meera Iyer"');
    const user = { id: "u1", username: "ravi", displayName: "Ravi", avatarUrl: "" };
    expect(linkedNote({ user, status: null }, false, null)).toBe("Will be asked to accept");
    expect(linkedNote({ user, status: "pending" }, false, null)).toBe("Will be asked to accept");
    expect(linkedNote({ user, status: "pending" }, true, null)).toBe("Pending");
    expect(linkedNote({ user, status: null }, false, "u1")).toBe("That's you: accepted right away");
    expect(linkedNote({ user: null, status: null }, true, null)).toBe("");
  });

  test("a server refusal is drawn under its field, in words", () => {
    for (const code of ["TOO_MANY_CREDITS", "INVALID_GENRE", "INVALID_RELEASE_YEAR", "INVALID_PRODUCTION_HOUSE", "CREDITS_NOT_ALLOWED", "INVALID_CREDIT"]) {
      const problem = creditsErrorProblem(code)!;
      const html = renderToStaticMarkup(<CreditsEditor value={EMPTY_CREDITS_FORM} onChange={() => undefined} genres={genres} variant="hub" problems={[problem]} showErrors />);
      expect(html).toContain(problem.message.replace(/&/g, "&amp;"));
      expect(html).not.toContain(code);
    }
  });
});

describe("credit requests list", () => {
  test("each request names the uploader, the video and the role, with Accept and Decline", () => {
    const page = decodeCreditRequestsPage(contractFixture("requests.json"));
    const html = renderToStaticMarkup(<CreditRequestsList items={page.items} onAnswer={() => undefined} />);
    expect(html).toContain("credited you in a video");
    expect(html).toContain("Kiran");
    expect(html).toContain("Monsoon Letters");
    expect(html).toContain("Blue Hour Films");
    expect(html).toContain('aria-label="Accept the Actor credit on Monsoon Letters"');
    expect(html).toContain('aria-label="Decline the Actor credit on Monsoon Letters"');
    expect(html).toContain('href="/posttube/watch/d1111111-1111-4111-8111-111111111111"');
  });
});
