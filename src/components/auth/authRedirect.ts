/** Keep return navigation on this origin; never pass untrusted schemes to the router. */
export function authRedirect(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/";
  return value;
}
