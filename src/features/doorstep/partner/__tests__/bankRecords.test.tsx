import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { BankRecords } from "../BankRecords"
import { decodeBank } from "../model"
import { STRICT } from "../../model/decode"

const account = {
  account_holder: "Test Partner", account_last4: "4321", ifsc: "SBIN0001234", status: "pending", bank_name: "Test Bank",
  history: [
    { id: "new", account_holder: "Test Partner", account_last4: "4321", ifsc: "SBIN0001234", bank_name: "Test Bank", status: "pending", active: true, submitted_at: "2026-10-08T10:00:00Z", reviewed_at: null, reason: null },
    { id: "old", account_holder: "Test Partner", account_last4: "6789", ifsc: "SBIN0001234", bank_name: "Previous Bank", status: "verified", active: false, submitted_at: "2026-10-07T10:00:00Z", reviewed_at: "2026-10-07T11:00:00Z", reason: "Proof reviewed" },
  ],
}
test("shows previous approval separately from pending replacement without editable account fields", () => {
  const bank = decodeBank(account, STRICT)!
  const html = renderToStaticMarkup(<BankRecords bank={bank} />)
  for (const text of ["Pending submission", "Previous record", "Approved", "Awaiting review", "Previous Bank", "6789", "4321", "not the current payout account", "No need to submit them again"]) expect(html).toContain(text)
  expect(html).not.toContain("<input")
  expect(bank).not.toHaveProperty("account_number")
})
test("older bank responses without history still display masked saved details", () => {
  const { history: _, ...legacy } = account
  const bank = decodeBank(legacy, STRICT)!
  expect(bank.history).toEqual([])
  expect(renderToStaticMarkup(<BankRecords bank={bank} />)).toContain("4321")
})
test("history rejects an unmasked account field in strict contract mode", () => {
  expect(() => decodeBank({ ...account, history: [{ ...account.history[0], account_number: "000123454321" }] }, STRICT)).toThrow()
})
test("approved account stays visibly active while an inactive replacement awaits review", () => {
 const bank=decodeBank({...account,status:"verified",account_last4:"6789",history:[{...account.history[0],active:false,superseded:false},{...account.history[1],active:true,superseded:false}]},STRICT)!
 const html=renderToStaticMarkup(<BankRecords bank={bank}/>)
 expect(html).toContain("Current payout account")
 expect(html).toContain("approved bank account remains active")
 expect(html).toContain("Pending submission")
 expect(html).not.toContain("Superseded")
})
