export const BUSINESS_SECTIONS = [
  { id: "doorstep-partner", label: "Home Services", href: "/doorstep/partner", sections: [
    ["Dashboard", "?tab=dashboard"], ["Jobs", "?tab=jobs"], ["Services & prices", "?tab=prices"], ["Earnings", "?tab=earnings"], ["Work settings", "?tab=setup"],
  ] },
  { id: "shop-partner", label: "Selling", href: "/shop/sell", sections: [
    ["Dashboard", ""], ["Work settings", "/onboarding"], ["Products", "/products"], ["Orders", "/orders"], ["Stock", "/stock"], ["Coupons", "/coupons"],
  ] },
  { id: "feast-partner", label: "Food", href: "/feast/kitchen", sections: [
    ["Dashboard", "?tab=orders"], ["Work settings", "?tab=setup"], ["Menu", "?tab=menu"], ["Earnings", "?tab=earnings"],
  ] },
  { id: "ride-partner", label: "Ride", href: "/mopedu/partner", sections: [
    ["Dashboard", "?tab=dashboard"], ["Work settings", "?tab=setup"], ["Vehicles", "?tab=vehicles"],
  ] },
  { id: "delivery-partner", label: "Delivery", href: "/feast/delivery", sections: [
    ["Dashboard", "?tab=dashboard"], ["Work settings", "?tab=setup"],
  ] },
] as const
export type BusinessId = typeof BUSINESS_SECTIONS[number]["id"]

export function sectionIsCurrent(pathname: string, tab: string | null, href: string) {
  const [path, query] = href.split("?")
  if (pathname !== path && !(path.startsWith("/shop/sell/") && pathname.startsWith(path + "/"))) return false
  const target = new URLSearchParams(query).get("tab")
  return target === null || (tab ?? (path === "/feast/kitchen" ? "orders" : "dashboard")) === target
}

/** A failed lookup must never be mistaken for a registered business. */
export function registeredBusinesses(results: PromiseSettledResult<boolean>[]) {
  return BUSINESS_SECTIONS.filter((_, i) => results[i]?.status === "fulfilled" && (results[i] as PromiseFulfilledResult<boolean>).value).map(b => b.id)
}
