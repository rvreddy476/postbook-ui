import type { Metadata } from "next"

import { FiltersScreen } from "@/features/dating/screens/FiltersScreen"

export const metadata: Metadata = { title: "Filters" }

export default function Page() {
  return <FiltersScreen />
}
