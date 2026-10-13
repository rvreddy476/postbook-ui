import { Suspense } from "react"
import { PartnerHub } from "@/features/partners/PartnerHub"
export default function Page() { return <Suspense fallback={<p role="status">Loading partner workspaces…</p>}><PartnerHub /></Suspense> }
