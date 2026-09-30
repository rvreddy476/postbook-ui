import { describe, expect, test } from "bun:test"

import {
  canRetryPayment,
  isOrderStatus,
  reviewRefusalMessage,
  statusLabel,
  toInvoiceLink,
  toOrderDetail,
  toOrdersPage,
  type WireInvoiceResponse,
  type WireOrderDetail,
  type WireOrdersPage,
  type WireShipmentsResponse,
} from "@/features/shop/model/orders"
import { buildTimeline, shipmentEvents } from "@/features/shop/orders/timeline"

import { hasFixture, readBackendFixture, readFixture, readLocalFixtureText } from "./contractFixtures"

/*
  orders/ fixtures (lane C1):
    orders_list_200, order_get_200_confirmed, order_get_200_delivered,
    order_get_200_payment_failed, order_items_get_200, order_shipments_get_200,
    order_invoice_get_200, order_cancel_post_204
  reviews/ fixtures: review_post_201, review_post_400_not_delivered
*/
const AREA = "orders"
const only = (area: string, name: string) => (hasFixture(area, name) ? test : test.skip)

describe("order fixtures parse through the mappers", () => {
  only(AREA, "orders_list_200")("orders_list_200: two rows, a cursor, every status in the vocabulary", () => {
    const { data, meta } = readFixture<WireOrdersPage>(AREA, "orders_list_200")
    const page = toOrdersPage(data, meta as { next_cursor?: string } | null)
    expect(page.rows.length).toBe(2)
    expect(page.nextCursor).toBeTruthy()
    for (const row of page.rows) {
      expect(row.orderNumber).toBeTruthy()
      expect(Number.isInteger(row.totalMinor)).toBe(true)
      expect(isOrderStatus(row.status)).toBe(true)
      expect(statusLabel(row.status).label).not.toBe("Unknown")
      expect(row.createdAtMs).toBeGreaterThan(0)
    }
  })

  only(AREA, "order_get_200_confirmed")("order_get_200_confirmed: items, address, totals, can_cancel; no payment action", () => {
    const { data } = readFixture<WireOrderDetail>(AREA, "order_get_200_confirmed")
    const o = toOrderDetail(data)
    expect(o.status).toBe("confirmed")
    expect(o.paymentStatus).toBe("paid")
    expect(o.items.length).toBeGreaterThan(0)
    expect(o.items[0].sellerId).toBeTruthy()
    expect(o.totalMinor).toBe(data.total_minor)
    expect(o.canRetryPayment).toBe(false)
    expect(buildTimeline({ status: o.status, paymentStatus: o.paymentStatus, createdAtMs: o.createdAtMs, shipments: [] }).map((e) => e.state)).toEqual(["done", "current", "todo", "todo", "todo", "todo"])
  })

  only(AREA, "order_get_200_delivered")("order_get_200_delivered: every item reviewable, the rail all done", () => {
    const { data } = readFixture<WireOrderDetail>(AREA, "order_get_200_delivered")
    const o = toOrderDetail(data)
    expect(o.status).toBe("delivered")
    expect(o.items.every((i) => i.delivered)).toBe(true)
    expect(buildTimeline({ status: o.status, paymentStatus: o.paymentStatus, createdAtMs: o.createdAtMs, shipments: [] }).every((e) => e.state === "done")).toBe(true)
  })

  only(AREA, "order_get_200_payment_failed")("order_get_200_payment_failed: can_retry_payment true → Try again", () => {
    const { data } = readFixture<WireOrderDetail>(AREA, "order_get_200_payment_failed")
    expect(data.can_retry_payment).toBe(true)
    expect(canRetryPayment(data)).toBe(true)
    const o = toOrderDetail(data)
    expect(o.status).toBe("payment_failed")
    expect(o.canRetryPayment).toBe(true)
  })

  only(AREA, "order_shipments_get_200")("order_shipments_get_200: shipments with events, in time order", () => {
    const { data } = readFixture<WireShipmentsResponse>(AREA, "order_shipments_get_200")
    const events = shipmentEvents(data.shipments)
    for (let i = 1; i < events.length; i++) expect(events[i].atMs).toBeGreaterThanOrEqual(events[i - 1].atMs)
    expect(data.shipments?.[0]?.shipment?.courier).toBeTruthy()
  })

  only(AREA, "order_invoice_get_200")("order_invoice_get_200: a signed download_url", () => {
    const { data } = readFixture<WireInvoiceResponse>(AREA, "order_invoice_get_200")
    expect(toInvoiceLink(data)?.url).toBe(data.download_url!)
  })

  only("reviews", "review_post_400_not_delivered")("review_post_400_not_delivered: the pinned refusal code becomes the one sentence", () => {
    const { error } = readFixture("reviews", "review_post_400_not_delivered")
    expect(error?.code).toBeTruthy()
    expect(reviewRefusalMessage(error!.code)).toBe("You can review this once it is delivered.")
  })
})

describe("order and review fixtures are byte-identical to the backend's", () => {
  const files: Array<[string, string]> = [
    [AREA, "orders_list_200"],
    [AREA, "order_get_200_confirmed"],
    [AREA, "order_get_200_delivered"],
    [AREA, "order_get_200_payment_failed"],
    [AREA, "order_items_get_200"],
    [AREA, "order_shipments_get_200"],
    [AREA, "order_invoice_get_200"],
    [AREA, "order_cancel_post_204"],
    ["reviews", "review_post_201"],
    ["reviews", "review_post_400_not_delivered"],
  ]
  for (const [area, name] of files) {
    const backend = hasFixture(area, name) ? readBackendFixture(area, name) : null
    ;(backend === null ? test.skip : test)(`${area}/${name}`, () => {
      expect(readLocalFixtureText(area, name)).toBe(backend as string)
    })
  }
})
