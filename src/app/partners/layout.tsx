import type { Metadata } from "next"
import type { ReactNode } from "react"
export const metadata: Metadata = { title: "Business Partners", description: "Register and manage your businesses with Clee Partners.", robots: { index: false, follow: false } }
export default function Layout({ children }: { children: ReactNode }) { return children }
