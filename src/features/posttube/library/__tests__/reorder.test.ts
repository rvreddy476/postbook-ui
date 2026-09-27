import { describe, expect, test } from "bun:test";

import { clampIndex, indexOfPost, moveBy, moveIndex, planMove, reconcileOrder, renumber } from "../reorder";

const rows = (ids: string[]) => ids.map((postId, position) => ({ postId, position, post: { id: postId } as unknown }));
const ids = (list: { postId: string }[]) => list.map((r) => r.postId);
const positions = (list: { position: number }[]) => list.map((r) => r.position);

describe("moveIndex", () => {
  test("moves down and renumbers 0..n-1", () => {
    const out = moveIndex(rows(["a", "b", "c", "d"]), 0, 2);
    expect(ids(out)).toEqual(["b", "c", "a", "d"]);
    expect(positions(out)).toEqual([0, 1, 2, 3]);
  });
  test("moves up", () => {
    expect(ids(moveIndex(rows(["a", "b", "c", "d"]), 3, 1))).toEqual(["a", "d", "b", "c"]);
  });
  test("clamps the target like the server (0 and n-1)", () => {
    expect(ids(moveIndex(rows(["a", "b", "c"]), 0, 99))).toEqual(["b", "c", "a"]);
    expect(ids(moveIndex(rows(["a", "b", "c"]), 2, -5))).toEqual(["c", "a", "b"]);
    expect(clampIndex(NaN, 3)).toBe(0);
    expect(clampIndex(2.9, 3)).toBe(2);
    expect(clampIndex(5, 0)).toBe(0);
  });
  test("a no-op returns the same array and never mutates the input", () => {
    const input = rows(["a", "b"]);
    expect(moveIndex(input, 1, 1)).toBe(input);
    moveIndex(input, 0, 1);
    expect(ids(input)).toEqual(["a", "b"]);
    expect(moveIndex([], 0, 1)).toEqual([]);
  });
});

describe("moveBy / planMove", () => {
  test("moveBy steps one place; the edges and unknown ids are no-ops", () => {
    const list = rows(["a", "b", "c"]);
    expect(ids(moveBy(list, "b", -1))).toEqual(["b", "a", "c"]);
    expect(ids(moveBy(list, "b", 1))).toEqual(["a", "c", "b"]);
    expect(moveBy(list, "a", -1)).toBe(list);
    expect(moveBy(list, "zzz", 1)).toBe(list);
  });
  test("planMove yields the optimistic order, the server position and a rollback snapshot", () => {
    const list = rows(["a", "b", "c", "d"]);
    const plan = planMove(list, "d", 0)!;
    expect(ids(plan.optimistic)).toEqual(["d", "a", "b", "c"]);
    expect(plan.position).toBe(0);
    expect(ids(plan.rollback)).toEqual(["a", "b", "c", "d"]);
    expect(plan.rollback).not.toBe(list);
    // rollback restores exactly the pre-move order and positions
    expect(positions(plan.rollback)).toEqual([0, 1, 2, 3]);
  });
  test("planMove is null for a no-op or an unknown id", () => {
    expect(planMove(rows(["a", "b"]), "a", 0)).toBeNull();
    expect(planMove(rows(["a", "b"]), "a", 99)).not.toBeNull();
    expect(planMove(rows(["a", "b"]), "nope", 1)).toBeNull();
  });
});

describe("reconcileOrder", () => {
  test("takes the server's order and keeps the hydrated post from the rows on screen", () => {
    const local = rows(["a", "b", "c"]);
    const server = [
      { postId: "c", position: 0, post: null },
      { postId: "a", position: 1, post: null },
      { postId: "b", position: 2, post: null },
    ];
    const out = reconcileOrder(server, local);
    expect(ids(out)).toEqual(["c", "a", "b"]);
    expect(positions(out)).toEqual([0, 1, 2]);
    expect((out[0] as { post: unknown }).post).toEqual({ id: "c" });
  });
  test("drops ids the server no longer has and keeps new ones unhydrated", () => {
    const out = reconcileOrder([{ postId: "x", position: 0, post: null }, { postId: "a", position: 1, post: null }], rows(["a", "b"]));
    expect(ids(out)).toEqual(["x", "a"]);
    expect((out[0] as { post: unknown }).post).toBeNull();
  });
  test("renumber and indexOfPost", () => {
    expect(positions(renumber([{ postId: "a", position: 7 }, { postId: "b", position: 1 }]))).toEqual([0, 1]);
    expect(indexOfPost(rows(["a", "b"]), "b")).toBe(1);
    expect(indexOfPost(rows(["a", "b"]), "q")).toBe(-1);
  });
});
