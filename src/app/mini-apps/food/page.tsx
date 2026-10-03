import { redirect } from "next/navigation"

// Food ordering lives in Feast; the old mini-app entry point sends people there.
export default function Page() {
  redirect("/feast")
}
