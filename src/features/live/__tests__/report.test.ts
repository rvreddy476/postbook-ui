import { describe, expect, it } from "bun:test"

import { REPORT_NOTE_MAX, REPORT_REASONS, isReportReason, reportBody, reportErrorCopy } from "../report"

const axiosErr = (status: number, code = "") => ({ response: { status, data: { error: { code, message: "server text" } } } })

describe("Report sheet", () => {
  it("offers exactly the contract's reasons, alphabetical by label", () => {
    expect(REPORT_REASONS.map((r) => r.value).sort()).toEqual(
      ["harassment", "hate", "nudity", "other", "scam", "spam", "violence"],
    )
    const labels = REPORT_REASONS.map((r) => r.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    expect(labels).toEqual([
      "Harassment or bullying", "Hate speech", "Nudity or sexual content", "Other", "Scam or fraud", "Spam", "Violence",
    ])
  })

  it("body: stream report is just the reason", () => {
    expect(reportBody({ reason: "spam" })).toEqual({ reason: "spam" })
    expect(reportBody({ reason: "spam", messageId: "", note: "   " })).toEqual({ reason: "spam" })
  })

  it("body: message report carries message_id and a trimmed note", () => {
    expect(reportBody({ reason: "harassment", messageId: "m1", note: "  rude  " }))
      .toEqual({ reason: "harassment", message_id: "m1", note: "rude" })
  })

  it("body: note capped, unknown reasons refused", () => {
    expect(reportBody({ reason: "other", note: "x".repeat(REPORT_NOTE_MAX + 50) })?.note?.length).toBe(REPORT_NOTE_MAX)
    expect(reportBody({ reason: "abuse" })).toBeNull()
    expect(reportBody({ reason: "" })).toBeNull()
    expect(isReportReason("toString")).toBe(false)
  })

  it("error copy by code, never the server's message", () => {
    expect(reportErrorCopy(axiosErr(409, "ALREADY_REPORTED"))).toBe("You've already reported this. Thanks for letting us know.")
    expect(reportErrorCopy(axiosErr(409, "REPORT_ALREADY_RESOLVED"))).toBe("We couldn't send your report. Try again.")
    expect(reportErrorCopy(axiosErr(409, "DUPLICATE_REPORT"))).toBe("We couldn't send your report. Try again.")
    expect(reportErrorCopy(axiosErr(422, "VALIDATION_ERROR"))).toBe("You can't report this.")
    expect(reportErrorCopy(axiosErr(404, "NOT_FOUND"))).toBe("That's no longer available.")
    expect(reportErrorCopy(axiosErr(401, "UNAUTHORIZED"))).toBe("Sign in to report.")
    expect(reportErrorCopy(axiosErr(429, "RATE_LIMITED"))).toBe("You've sent a lot of reports. Try again in a little while.")
    expect(reportErrorCopy(axiosErr(500))).toBe("We couldn't send your report. Try again.")
  })
})
