import { NextRequest, NextResponse } from "next/server"

/**
 * Route gate.
 *
 * Until now there was no middleware at all: every authenticated page,
 * including every /admin surface, was rendered and sent to anyone who asked
 * for the URL. The only check was a client-side getSession() inside the page,
 * which runs after the HTML has already been delivered.
 *
 * WHAT THIS GATES ON, AND WHAT THAT IS WORTH
 * ------------------------------------------
 * The signal is the `pb_auth` cookie: httpOnly, SameSite=Lax, Secure in
 * production, set by the BFF auth routes under /api/auth alongside the
 * httpOnly refresh cookie, and cleared on logout or on a refused refresh.
 * Session state used to live only in localStorage, which middleware cannot
 * read, so that cookie is what made any server-side check possible.
 *
 * It is a coarse gate, and it is worth being exact about its limits:
 *
 *   - It proves this browser completed a login and has not logged out. It
 *     does NOT prove the session is still valid: a refresh token revoked
 *     server-side (by logout-all, an admin force-logout, or the upstream's
 *     fingerprint check) leaves the cookie in place until the next refresh
 *     attempt fails.
 *   - It carries NO identity and NO roles. So /admin/* is gated to
 *     "signed in", not to "is an admin". Any logged-in user still reaches
 *     every admin page's HTML. What stops them is the API behind it: the
 *     gateway strips client-supplied identity headers and re-stamps X-Scopes
 *     from the signed token, and the services authorise on that claim. The
 *     pages will render and their data calls will 403.
 *   - It is presence, not proof, so nothing downstream should read it as
 *     authorisation. Real enforcement stays at the gateway and the services.
 *
 * Closing the admin gap properly needs a role signal middleware can trust —
 * a signed, readable session claim rather than an opaque flag. That is a
 * server change, not something this file can invent.
 */

/** Set by the BFF auth routes. Presence only; see above. */
const SESSION_FLAG_COOKIE = "pb_auth"

/**
 * Routes that must work signed out. Anything not listed here is gated, so a
 * new authenticated route is protected by default rather than by remembering
 * to add it.
 */
const PUBLIC_EXACT = new Set([
    "/",
    "/login",
    "/register",
    // Marketing / statutory pages built for signed-out visitors. /commerce is
    // the seller pitch and links to /login?redirect=/seller/onboarding itself;
    // /grievance is the grievance-officer contact page.
    "/commerce",
    "/grievance",
    "/apps",
    "/posts-demo",
    // The consent links on /register point here. Gating them behind login
    // means nobody can read what they are being asked to accept BEFORE
    // they have an account, which is the only time it matters.
    "/terms",
    "/privacy",
])

const PUBLIC_PREFIXES = [
    // Every auth flow: 2fa, callback, forgot-password, oauth, step-up,
    // verify-email. Gating these would make signing in impossible.
    "/auth/",
    // Share links that must resolve for someone who is not signed in.
    "/memories/slambooks/share/",
    // Public profile surfaces: username, business page, channel.
    "/u/",
    "/page/",
    "/channel/",
    // Content permalinks people paste into other apps.
    "/post/",
    "/posttube/watch",
    // Storefront product detail — a shared product link should open.
    "/products/",
]

/**
 * Paths middleware must not touch.
 *
 * /v1 matters and is easy to miss: next.config.ts rewrites /v1/:path* to
 * /api/proxy/:path*, and middleware runs BEFORE that rewrite. Without this
 * exclusion every API call the app makes — login included — would be
 * answered with a redirect to /login.
 *
 * /api is excluded because those routes authenticate on the bearer token (or,
 * for the BFF auth routes, are how a session is established in the first
 * place). Gating them on a presence cookie would add nothing and would break
 * login, refresh and logout.
 */
const UNGATED_PREFIXES = ["/v1/", "/api/", "/_next/", "/static/"]

/** "/login/" and "/login" are the same route; compare one spelling. */
const normalise = (pathname: string) =>
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname

const isPublicPath = (pathname: string) => {
    if (PUBLIC_EXACT.has(pathname)) return true
    // Prefixes are written with their trailing slash so "/u/" cannot also
    // match a future "/users". Test the un-normalised path too, so a bare
    // "/u" does not slip past on the normalised one.
    return PUBLIC_PREFIXES.some(
        (prefix) => pathname.startsWith(prefix) || pathname === normalise(prefix),
    )
}

/**
 * Static files served from /public.
 *
 * An explicit extension list rather than "the last segment contains a dot":
 * that shortcut would treat any gated route whose dynamic segment happens to
 * contain a dot — an order id, a topic slug, a hashtag — as a static asset
 * and wave it straight through. A default-deny gate cannot afford a guess
 * that fails open.
 */
const STATIC_FILE_EXTENSIONS = [
    ".ico", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif",
    ".css", ".js", ".map", ".json", ".txt", ".xml", ".webmanifest",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp4", ".webm", ".mp3", ".wav", ".pdf",
]

const isUngatedPath = (pathname: string) => {
    if (pathname === "/v1" || pathname === "/api") return true
    if (UNGATED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
    const lowered = pathname.toLowerCase()
    return STATIC_FILE_EXTENSIONS.some((ext) => lowered.endsWith(ext))
}

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl
    const path = normalise(pathname)

    if (isUngatedPath(path) || isPublicPath(path)) {
        return NextResponse.next()
    }

    if (req.cookies.get(SESSION_FLAG_COOKIE)?.value) {
        return NextResponse.next()
    }

    const loginUrl = new URL("/login", req.url)

    // `next` is the parameter this gate defines. `redirect` is what
    // src/app/login/page.tsx actually reads today, so both are set — without
    // the second one the return path silently drops and everyone lands on /.
    // Once the login page prefers `next`, `redirect` can go.
    const returnTo = `${pathname}${search}`
    loginUrl.searchParams.set("next", returnTo)
    loginUrl.searchParams.set("redirect", returnTo)

    const res = NextResponse.redirect(loginUrl)
    // A gate decision must never be cached by a shared cache and served to
    // the next visitor.
    res.headers.set("Cache-Control", "no-store, must-revalidate")
    return res
}

export const config = {
    /**
     * Skip the framework's own paths, the /v1 API rewrite and static assets
     * before middleware even runs. The in-code guards above repeat these
     * checks so a matcher edit cannot quietly open a hole.
     */
    matcher: ["/((?!api/|v1/|_next/|static/|favicon.ico|robots.txt|sitemap.xml).*)"],
}
