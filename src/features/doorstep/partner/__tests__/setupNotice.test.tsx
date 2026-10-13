import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PartnerSetupNotice, type SetupState } from "../PartnerSetupNotice"
import { PARTNER_STEPS, stepState, type Readiness, type StepCode, decodeBank } from "../model"
import { LENIENT } from "../../model/decode"
const ready: Readiness={status:"approved",missing_steps:[],completed_steps:PARTNER_STEPS.map(s=>s.code),recommended_steps:[],can_go_on_duty:false}
const states=()=>Object.fromEntries(PARTNER_STEPS.map(s=>[s.code,"complete"])) as Record<StepCode,SetupState>
const render=(s:Record<StepCode,SetupState>,r=ready)=>renderToStaticMarkup(<PartnerSetupNotice readiness={r} states={s} onReview={()=>{}}/>)
test("pending bank review does not ask the partner to complete setup again",()=>{
 const s=states();s.bank="review"
 const html=render(s)
 expect(html).toContain("awaiting review")
 expect(html).toContain("No need to submit")
 expect(html).not.toContain("Complete your setup")
 expect(html).not.toContain("ds-setup-warning")
})
test("saved working location awaiting platform coverage is informational, not an incomplete bank warning",()=>{
 const s=states();s.service_area="saved"
 const html=render(s)
 expect(html).toContain("Service coverage")
 expect(html).not.toContain("Bank account")
 expect(html).not.toContain("Complete your setup")
})
test("genuinely missing details still show actionable setup guidance",()=>{
 const s=states();s.bank="needed"
 expect(render(s)).toContain("Bank account")
 expect(render(s)).toContain("Complete your setup")
 expect(render(s,{...ready,can_go_on_duty:true})).toBe("")
})
test("bank state uses current approval before pending replacement and recognizes initial pending review",()=>{
 const bank=decodeBank({account_holder:"Test",account_last4:"1111",ifsc:"SBIN0001234",status:"pending"},LENIENT)
 expect(stepState("bank",{...ready,completed_steps:[]},[],[],undefined,bank)).toBe("review")
 expect(stepState("bank",ready,[],[],undefined,bank)).toBe("complete")
})
