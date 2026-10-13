import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { BankDetails, bankBody, bankErrors, emptyBank } from "../BankDetails"

const valid = () => ({ ...emptyBank, holder:"Test Partner",number:"000123456789",confirm:"000123456789",ifsc:"SBIN0001234",bankName:"State Bank",proof:new File(["test"],"proof.jpg",{type:"image/jpeg"}) })
test("bank verification requires complete matching details and a supported proof",()=>{
 expect(bankErrors(valid())).toEqual({})
 for(const patch of [{holder:""},{number:"123"},{confirm:"123"},{ifsc:"WRONG"},{bankName:""},{proof:null},{proofKind:"other"},{branchName:"A"}]) expect(Object.keys(bankErrors({...valid(),...patch})).length).toBeGreaterThan(0)
 expect(bankErrors({...valid(),proof:new File(["x"],"bank.pdf",{type:"application/pdf"})}).proof).toBeTruthy()
})
test("bank fields use labelled errors, masked numbers and do not collect credentials",()=>{
 const html=renderToStaticMarkup(<BankDetails value={{...emptyBank}} onChange={()=>{}} errors={{ifsc:"Enter a valid IFSC"}} />)
 for(const label of ["Account holder name","Account number","Confirm account number","IFSC","Bank name","Bank proof","Cancelled cheque","Passbook"]) expect(html).toContain(label)
 expect(html).toContain('aria-invalid="true"'); expect(html).toContain('type="password"'); expect(html).not.toContain("PIN")
})
test("bank submission includes proof and excludes confirmation",()=>{
 const body=bankBody(valid(),"proof-id")
 expect(body.proof_media_id).toBe("proof-id"); expect(body.bank_name).toBe("State Bank"); expect("confirm" in body).toBe(false)
})
test("corrected bank fields clear their stale validation message",()=>{
 const html=renderToStaticMarkup(<BankDetails value={valid()} onChange={()=>{}} errors={{ifsc:"Enter a valid IFSC",holder:"Enter the name"}} />)
 expect(html).not.toContain('aria-invalid="true"')
 expect(html).not.toContain('Enter a valid IFSC')
})
