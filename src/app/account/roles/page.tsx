import { redirect } from "next/navigation"
import { portalRole, portalLogoutHref } from "@/components/auth/portalRoles"

/** Compatibility for old bookmarks; the extra role-picker page is gone. */
export default async function Page({ searchParams }: { searchParams: Promise<{ choose?: string }> }) {
  const role = portalRole((await searchParams).choose)
  redirect(role ? portalLogoutHref(role.id) : "/login")
}
