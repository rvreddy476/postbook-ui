/*
  The New message picker's selection rules (NewMessageSheet.tsx): one person
  opens a direct chat, two or more start a group. Pure, so the tests pin it.
*/

/** How many people can be picked when starting a group from here. */
export const MAX_GROUP_PICK = 31

/** Toggle a person; with max 1 a new pick replaces the old one. */
export function toggleRecipient<T extends { id: string }>(picked: readonly T[], person: T, max: number): T[] {
  if (picked.some((p) => p.id === person.id)) return picked.filter((p) => p.id !== person.id)
  if (max <= 1) return [person]
  if (picked.length >= max) return picked.slice()
  return [...picked, person]
}

/** The typed name, else the first names of the people picked ("Asha, Ravi and 2 others"). */
export function groupTitleFor(typed: string, picked: readonly { name: string }[]): string {
  const name = typed.trim()
  if (name) return name.slice(0, 80)
  const firsts = picked.map((p) => (p.name || '').trim().split(/\s+/)[0]).filter(Boolean)
  if (firsts.length === 0) return 'New group'
  if (firsts.length <= 3) return firsts.join(', ')
  return `${firsts.slice(0, 2).join(', ')} and ${firsts.length - 2} others`
}
