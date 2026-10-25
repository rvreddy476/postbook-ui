import { describe, expect, test } from "bun:test";

import { publishFailure, studioCreateFields, studioDraftCreditFields, studioTakesCredits } from "../studioApi";
import { STEP_SCHEMAS, studioSteps } from "../tokens";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";
import { canPublish, getStepErrors } from "../validation";
import { creditsErrorProblem, type CreditsForm } from "@/features/posttube/credits/creditsModel";
import { contractError, contractFixture, creditKeysOf } from "@/features/posttube/credits/__tests__/contracts";

/*
  The studio's Credits step (contract 23 Oct 2026): offered, and sent with
  the create request or the draft, only for a long video whose topic is
  film & animation, entertainment, comedy, music, documentary or podcasts.
*/

const credits: CreditsForm = {
  credits: [
    { key: 1, name: "Asha Rao", role: "Director", user: { id: "u-asha", username: "asha", displayName: "Asha Rao", avatarUrl: "" }, status: null },
    { key: 2, name: "Ravi Kumar", role: "Actor", user: null, status: null },
  ],
  genres: ["drama"],
  releaseYear: "2024",
  productionHouse: "Blue Hour Films",
};

const form = (patch: Partial<StudioFormState> = {}): StudioFormState => ({ ...INITIAL_FORM_STATE, contentType: "long", title: "Film", credits, ...patch });

describe("the Credits step", () => {
  test("sits before Publish for a long video in a credits topic, and nowhere else", () => {
    expect(studioSteps("long", true)).toEqual(["video", "details", "audience", "engage", "enrich", "credits", "publish"]);
    expect(studioSteps("podcast", true)).toContain("credits");
    expect(studioSteps("long", false)).toEqual(STEP_SCHEMAS.long);
    expect(studioSteps("reel", true)).toEqual(STEP_SCHEMAS.reel);
    expect(studioSteps("short", true)).toEqual(STEP_SCHEMAS.short);
  });

  test("the topic and the classification decide it", () => {
    expect(studioTakesCredits(form({ category: "film-animation" }), true)).toBe(true);
    expect(studioTakesCredits(form({ category: "podcasts", contentType: "podcast" }), true)).toBe(true);
    expect(studioTakesCredits(form({ category: "education" }), true)).toBe(false);
    expect(studioTakesCredits(form({ category: "film-animation" }), false)).toBe(false);
    expect(studioTakesCredits(form({ category: "music", contentType: "reel" }), true)).toBe(false);
  });

  test("its errors use the field ids the error list focuses, and block publishing", () => {
    const bad = form({ category: "music", credits: { ...credits, credits: [{ key: 7, name: "", role: "Actor", user: null, status: null }], releaseYear: "1800" } });
    expect(getStepErrors("credits", bad).map((e) => e.field)).toEqual(["credit-7-name", "releaseYear"]);
    const steps = studioSteps("long", true);
    const ready = form({ category: "music", videoFile: new File(["x"], "v.mp4"), currentStep: "publish" });
    expect(canPublish(ready, steps)).toBe(true);
    expect(canPublish({ ...ready, credits: bad.credits }, steps)).toBe(false);
  });
});

describe("the request builder", () => {
  test("create: credits, genres, year and production house for an allowed topic on a long video", () => {
    const f = studioCreateFields(form({ category: "film-animation" }), { longVideo: true });
    expect(f).toMatchObject({
      credits: [
        { name: "Asha Rao", role: "Director", user_id: "u-asha" },
        { name: "Ravi Kumar", role: "Actor" },
      ],
      genres: ["drama"],
      release_year: 2024,
      production_house: "Blue Hour Films",
      title: "Film",
      category: "film-animation",
    });
  });

  test("create: nothing for another topic, a short, or a file that classified as a short", () => {
    for (const f of [
      studioCreateFields(form({ category: "education" }), { longVideo: true }),
      studioCreateFields(form({ category: "music", contentType: "reel" }), { longVideo: true }),
      studioCreateFields(form({ category: "music" }), { longVideo: false }),
      studioCreateFields(form({ category: "music" })),
    ]) {
      for (const key of ["credits", "genres", "release_year", "production_house"]) expect(key in f).toBe(false);
    }
  });

  test("draft: the whole list replaces what the draft holds; a switched topic clears it", () => {
    expect(studioDraftCreditFields(form({ category: "comedy" }), true)).toMatchObject({ genres: ["drama"], release_year: 2024, production_house: "Blue Hour Films" });
    expect(studioDraftCreditFields(form({ category: "comedy" }), true).credits).toHaveLength(2);
    expect(studioDraftCreditFields(form({ category: "education" }), true)).toEqual({ credits: [], genres: [], release_year: null, production_house: null });
    expect(studioDraftCreditFields(form({ category: "comedy" }), false)).toEqual({});
    // A year or house typed and then removed is cleared on the draft, not kept.
    expect(studioDraftCreditFields(form({ category: "comedy", credits: { ...credits, releaseYear: "", productionHouse: " " } }), true)).toMatchObject({ release_year: null, production_house: null });
  });

  test("the server's requests: create_request's and reel_draft_patch_request's credit keys", () => {
    const fixtureForm = form({
      category: "film-animation",
      credits: {
        credits: [
          { key: 1, name: "Asha Rao", role: "Director", user: { id: "d3333333-3333-4333-8333-333333333333", username: "asha", displayName: "Asha Rao", avatarUrl: "" }, status: null },
          { key: 2, name: "Ravi Kumar", role: "Actor", user: { id: "d4444444-4444-4444-8444-444444444444", username: "ravi", displayName: "Ravi Kumar", avatarUrl: "" }, status: null },
          { key: 3, name: "Meera Iyer", role: "Music", user: null, status: null },
        ],
        genres: ["drama", "romance"],
        releaseYear: "2024",
        productionHouse: "Blue Hour Films",
      },
    });
    expect(creditKeysOf(studioCreateFields(fixtureForm, { longVideo: true }))).toEqual(creditKeysOf(contractFixture("create_request.json") as Record<string, unknown>));
    const drafted = { ...fixtureForm, credits: { ...fixtureForm.credits, credits: [fixtureForm.credits.credits[0], fixtureForm.credits.credits[2]], genres: ["drama"] } };
    // The draft PATCH the studio sends carries content_type (the classification) beside the credit keys.
    expect({ content_type: "long_video", ...studioDraftCreditFields(drafted, true) }).toEqual(contractFixture("reel_draft_patch_request.json") as Record<string, unknown>);
  });
});

describe("a refused publish", () => {
  test("credits codes read as the Credits step's sentence, never the server's developer message", () => {
    for (const name of ["error_credits_not_allowed.json", "error_invalid_genre.json"]) {
      const failure = publishFailure(contractError(name))!;
      const server = (contractFixture(name) as { error: { code: string; message: string } }).error;
      expect(failure.code).toBe(server.code);
      expect(failure.message).not.toContain(server.message);
      expect(failure.message).toBe(creditsErrorProblem(server.code)!.message);
    }
    for (const code of ["TOO_MANY_CREDITS", "INVALID_CREDIT", "INVALID_RELEASE_YEAR", "INVALID_PRODUCTION_HOUSE"]) {
      const failure = publishFailure({ response: { data: { error: { code, message: "dev text" } } } })!;
      expect(failure.message).toBe(creditsErrorProblem(code)!.message);
    }
    // Any other code keeps the server's message.
    expect(publishFailure({ response: { data: { error: { code: "CHANNEL_REQUIRED", message: "Create a channel first" } } } })!.message).toBe("Create a channel first.");
  });
});
