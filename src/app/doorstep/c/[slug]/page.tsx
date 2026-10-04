import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { CategoryScreen } from "@/features/doorstep/screens/CategoryScreen"

export const metadata: Metadata = {
  title: "Services · Doorstep",
  robots: { index: false },
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <CategoryScreen slug={slug} />
      </Suspense>
    </DoorstepFrame>
  )
}
