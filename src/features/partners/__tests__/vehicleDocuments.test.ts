import { describe, expect, test } from "bun:test"
import { vehicleDocumentBody } from "../VehicleDocuments"
import { identityDocumentBody } from "../Documents"
const media = "cd723bf8-40be-4c54-b699-c5163f1ff904"
describe("vehicle document submission", () => {
  test("uses the vehicle document contract, not a partner identity attachment", () => {
    const body = vehicleDocumentBody("vehicle_insurance", "POLICY-TEST", media, "2099-01-01")
    expect(body.document_type).toBe("vehicle_insurance")
    expect(body.media_id).toBe(media)
    expect(body.expires_at).toBe("2099-01-01T18:29:59.000Z")
  })
  test("requires valid document type, image, number and current expiry", () => {
    expect(() => vehicleDocumentBody("passport", "X", media, "2099-01-01")).toThrow()
    expect(() => vehicleDocumentBody("vehicle_rc", "", media, "")).toThrow()
    expect(() => vehicleDocumentBody("vehicle_rc", "TEST", "public-url", "")).toThrow()
    expect(() => vehicleDocumentBody("permit", "TEST", media, "")).toThrow()
    expect(() => vehicleDocumentBody("permit", "TEST", media, "2020-01-01")).toThrow()
    expect(vehicleDocumentBody("vehicle_rc", "TS09AB1234", media, "").expires_at).toBeUndefined()
  })
  test("delivery RC carries the registration number", () => {
    expect(identityDocumentBody("delivery", "VEHICLE_RC", "TS09AB1234", media)).toEqual({document_type:"VEHICLE_RC",document_number:"TS09AB1234",media_id:media})
  })
})
