import type { Metadata } from "next"

import { PersonScreen } from "@/features/dating/screens/PersonScreen"

export const metadata: Metadata = { title: "Profile" }

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  return <PersonScreen userId={userId} />
}
