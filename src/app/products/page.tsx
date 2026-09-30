import { redirect } from "next/navigation"

// The browse page moved to the MStore zone. Kept so old links still land.
export default function ProductsRedirect() {
  redirect("/shop/browse")
}
