/*
  The meta line under a People-you-may-know card.

  "Follows you" (founder, 25 Oct 2026): suggestion-service suggests people
  who follow the viewer and whom the viewer has not followed back, with the
  reason code FOLLOWS_YOU. The card's only action is Follow, so the line says
  why: "Follows you", then the mutual-friend count when there is one.

  The label comes from the reason code, not from explain_text, so it stays
  the same whatever else the server puts in explain_text.
*/

export const REASON_FOLLOWS_YOU = 'FOLLOWS_YOU'
export const FOLLOWS_YOU_LABEL = 'Follows you'

export interface SuggestionReasonFields {
  reason_codes?: string[]
  mutual_friend_count?: number
}

export function followsYou(s: SuggestionReasonFields): boolean {
  return !!s.reason_codes?.includes(REASON_FOLLOWS_YOU)
}

function mutualFriends(count: number): string {
  return `${count} mutual friend${count === 1 ? '' : 's'}`
}

/** The card's meta line; `fallback` is shown when there is no reason to give. */
export function suggestionMetaLine(s: SuggestionReasonFields, fallback: string): string {
  const mutuals = s.mutual_friend_count && s.mutual_friend_count > 0 ? mutualFriends(s.mutual_friend_count) : ''
  if (followsYou(s)) return mutuals ? `${FOLLOWS_YOU_LABEL} · ${mutuals}` : FOLLOWS_YOU_LABEL
  return mutuals || fallback
}
