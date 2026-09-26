export type Reaction = 'like' | 'love' | 'smile' | 'wow' | 'sad' | 'angry'
export const REACTIONS = [
  { value: 'like', label: 'Like', emoji: '👍' },
  { value: 'love', label: 'Love', emoji: '❤️' },
  { value: 'smile', label: 'Smile', emoji: '😊' },
  { value: 'wow', label: 'Wow', emoji: '😮' },
  { value: 'sad', label: 'Sad', emoji: '😢' },
  { value: 'angry', label: 'Angry', emoji: '😠' },
] as const
export function normalizeReaction(value: unknown): Reaction | null {
  const name = typeof value === 'object' && value !== null ? (value as {type?:unknown}).type : value
  if (name === 'haha') return 'smile'
  return REACTIONS.find(option => option.value === name)?.value ?? null
}
/** The post-service's smiling reaction is named haha, unlike group-service. */
export function postReactionName(value: Reaction): string { return value === 'smile' ? 'haha' : value }
