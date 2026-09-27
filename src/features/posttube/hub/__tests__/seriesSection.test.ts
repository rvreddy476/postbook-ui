import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import api from "@/lib/api";
import { applySeriesPlan, planSeriesChange } from "@/features/upload/studioApi";
import { defaultEpisodeFor } from "../components/SeriesSection";

const inA = { seriesId: "A", episodeNum: 2 };

describe("planSeriesChange", () => {
  test("no series before and none chosen: nothing to do", () => {
    expect(planSeriesChange(null, { kind: "none" }, null)).toEqual({ kind: "noop" });
  });
  test("leaving a series removes it", () => {
    expect(planSeriesChange(inA, { kind: "none" }, null)).toEqual({ kind: "remove", from: "A" });
  });
  test("joining a series adds it", () => {
    expect(planSeriesChange(null, { kind: "existing", id: "B", title: "B" }, 3)).toEqual({ kind: "add", choice: { kind: "existing", id: "B", title: "B" }, episode: 3 });
  });
  test("same series, same (or no) number: nothing to do", () => {
    expect(planSeriesChange(inA, { kind: "existing", id: "A", title: "A" }, null)).toEqual({ kind: "noop" });
    expect(planSeriesChange(inA, { kind: "existing", id: "A", title: "A" }, 2)).toEqual({ kind: "noop" });
  });
  test("a renumber or a different series is a move", () => {
    expect(planSeriesChange(inA, { kind: "existing", id: "A", title: "A" }, 5)).toMatchObject({ kind: "move", from: "A", episode: 5 });
    expect(planSeriesChange(inA, { kind: "existing", id: "B", title: "B" }, null)).toMatchObject({ kind: "move", from: "A" });
    expect(planSeriesChange(inA, { kind: "new", title: "Fresh" }, null)).toMatchObject({ kind: "move", from: "A", choice: { kind: "new" } });
  });
});

describe("applySeriesPlan", () => {
  afterEach(() => mock.restore());

  test("a move removes, then adds with the default number", async () => {
    const del = spyOn(api, "delete").mockResolvedValue({ data: {} } as never);
    const get = spyOn(api, "get").mockResolvedValue({ data: { data: [{ post_id: "x", episode_num: 4 }] } } as never);
    const post = spyOn(api, "post").mockResolvedValue({ data: {} } as never);
    const out = await applySeriesPlan("p1", inA, { kind: "move", from: "A", choice: { kind: "existing", id: "B", title: "B" }, episode: null });
    expect(del.mock.calls[0][0]).toBe("/v1/video-series/A/episodes/p1");
    expect(get.mock.calls[0][0]).toBe("/v1/video-series/B/episodes");
    expect(post.mock.calls[0]).toEqual(["/v1/video-series/B/episodes", { post_id: "p1", episode_num: 5 }]);
    expect(out).toEqual({ seriesId: "B", episodeNum: 5 });
  });

  test("a failed add after the remove puts the post back where it was, then throws", async () => {
    spyOn(api, "delete").mockResolvedValue({ data: {} } as never);
    const post = spyOn(api, "post")
      .mockRejectedValueOnce(Object.assign(new Error("taken"), { response: { status: 409 } }))
      .mockResolvedValue({ data: {} } as never);
    await expect(applySeriesPlan("p1", inA, { kind: "move", from: "A", choice: { kind: "existing", id: "B", title: "B" }, episode: 3 })).rejects.toThrow("taken");
    expect(post.mock.calls[1]).toEqual(["/v1/video-series/A/episodes", { post_id: "p1", episode_num: 2 }]);
  });

  test("remove only deletes", async () => {
    const del = spyOn(api, "delete").mockResolvedValue({ data: {} } as never);
    const post = spyOn(api, "post");
    expect(await applySeriesPlan("p1", inA, { kind: "remove", from: "A" })).toBeNull();
    expect(del).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });
});

describe("defaultEpisodeFor", () => {
  test("ignores this post's own row, so a renumber in place suggests the right next number", () => {
    const eps = [{ postId: "p1", episodeNum: 7 }, { postId: "q", episodeNum: 3 }];
    expect(defaultEpisodeFor(eps, "p1", { kind: "existing", id: "A", title: "A" })).toBe(4);
    expect(defaultEpisodeFor(eps, "other", { kind: "existing", id: "A", title: "A" })).toBe(8);
    expect(defaultEpisodeFor(undefined, "p1", { kind: "new", title: "x" })).toBe(1);
    expect(defaultEpisodeFor(eps, "p1", { kind: "none" })).toBeNull();
  });
});
