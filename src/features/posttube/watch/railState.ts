/*
  The rail's Love / Pass pair. Love is POST /v1/posts/:id/like (a toggle;
  the server clears the private dislike); Pass is POST|DELETE
  /v1/posts/:id/tune (the server clears the like). The UI keeps the two
  mutually exclusive on the spot, before the server answers, and the count
  follows the love. Pure reducer so the exclusivity is pinned by tests.
*/

export interface RailState {
  loved: boolean;
  passed: boolean;
  likeCount: number;
}

export type RailAction =
  | { type: "sync"; loved: boolean; passed: boolean; likeCount: number }
  | { type: "love" }
  | { type: "pass" }
  /** The server's answer to a love: the truth for `loved` and the count. */
  | { type: "settle-love"; loved: boolean; likeCount: number }
  /** A failed request: back to what it was. */
  | { type: "revert"; state: RailState };

export const RAIL_IDLE: RailState = { loved: false, passed: false, likeCount: 0 };

export function railReducer(state: RailState, action: RailAction): RailState {
  switch (action.type) {
    case "sync":
      return { loved: action.loved, passed: action.passed && !action.loved, likeCount: Math.max(0, action.likeCount) };
    case "love": {
      const loved = !state.loved;
      return {
        loved,
        passed: loved ? false : state.passed,
        likeCount: Math.max(0, state.likeCount + (loved ? 1 : -1)),
      };
    }
    case "pass": {
      const passed = !state.passed;
      const dropsLove = passed && state.loved;
      return {
        passed,
        loved: dropsLove ? false : state.loved,
        likeCount: dropsLove ? Math.max(0, state.likeCount - 1) : state.likeCount,
      };
    }
    case "settle-love":
      return { loved: action.loved, passed: action.loved ? false : state.passed, likeCount: Math.max(0, action.likeCount) };
    case "revert":
      return { ...action.state };
    default:
      return state;
  }
}
