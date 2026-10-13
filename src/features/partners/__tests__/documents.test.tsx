import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PartnerDocuments, identityDocumentBody } from "../Documents"
const MEDIA = "12345678-1234-4234-8234-123456789abc"
describe("manual partner identity", () => {
  test("only the four permitted identity types reach either module", () => {
    for (const module of ["ride", "delivery"] as const) for (const kind of ["PASSPORT", "VOTER_ID", "DRIVING_LICENCE", "PAN"]) {
      const body = identityDocumentBody(module, kind, "KA0120200000001", MEDIA)
      expect(body.media_id).toBe(MEDIA)
      expect("status" in body).toBe(false)
      expect("verified" in body).toBe(false)
      expect("document_number" in body).toBe(kind === "DRIVING_LICENCE")
    }
    expect(() => identityDocumentBody("ride", "AADHAAR", "", MEDIA)).toThrow()
    expect(() => identityDocumentBody("delivery", "PAN", "", "unconfirmed")).toThrow()
    expect(() => identityDocumentBody("ride", "DRIVING_LICENCE", "", MEDIA)).toThrow()
  })
  test("both forms offer uploads and explicitly distinguish manual review from approval", () => {
    for (const module of ["ride", "delivery"] as const) {
      const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><PartnerDocuments module={module} userId="test-user" /></QueryClientProvider>)
      for (const text of ["Passport", "Voter ID", "PAN card", "Driving licence (required)", "Every rider must upload a driving licence", "Submit for review"]) expect(html).toContain(text)
      expect(html).toContain('type="file"')
      expect(html).not.toContain("Continue to DigiLocker")
    }
  })
})
