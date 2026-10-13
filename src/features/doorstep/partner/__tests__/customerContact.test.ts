import { expect, spyOn, test } from "bun:test"
import api from "@/lib/api"
import { partnerApi } from "../api"

test("contact requests are booking-scoped, cancellable and decoded from the server envelope", async () => {
  const get = spyOn(api, "get").mockResolvedValue({ data: { data: { phone: "+919876543210" } } })
  try {
    const signal = new AbortController().signal
    expect(await partnerApi.customerContact("booking/id", signal)).toBe("+919876543210")
    expect(get).toHaveBeenCalledWith("/v1/doorstep/pro/jobs/booking%2Fid/customer-contact", { signal })
  } finally { get.mockRestore() }
})

test("invalid or unavailable customer contact never produces a dial link", async () => {
  const get = spyOn(api, "get")
  try {
    for (const phone of [null, "", "javascript:alert(1)", "+919876543210;123", "12345"]) {
      get.mockResolvedValue({ data: { data: { phone } } })
      await expect(partnerApi.customerContact("booking-id")).rejects.toThrow()
    }
    get.mockRejectedValue({ isAxiosError: true, response: { status: 404, data: { error: { code: "DOORSTEP_BOOKING_NOT_FOUND", message: "booking not found" } } } })
    await expect(partnerApi.customerContact("booking-id")).rejects.toMatchObject({ status: 404 })
  } finally { get.mockRestore() }
})
