import type { Metadata } from "next"

import { PhotosScreen } from "@/features/dating/screens/OnboardingScreens"

export const metadata: Metadata = { title: "Photos" }

export default function Page() {
  return <PhotosScreen />
}
