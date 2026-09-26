/** The signed-in user's id, as the app stores it after login. "" when unknown. */
export function readSessionUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("postbook_session");
    if (!raw) return "";
    const session = JSON.parse(raw) as { id?: string } | null;
    return session?.id || "";
  } catch {
    return "";
  }
}
