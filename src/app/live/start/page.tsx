import { redirect } from "next/navigation"

/**
 * /live/start was the v1 (MediaMTX) studio. v1 is retired: live-service-v2
 * (LiveKit) is the only live stack, and going live starts at /live/new.
 */
export default function LiveStartRedirect(): never {
  redirect("/live/new")
}
