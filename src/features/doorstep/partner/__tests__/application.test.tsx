import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PartnerApplication, ApplicationReceipt, SubmittedApplication } from "../PartnerApplication"
import { PartnerErrorState } from "../ui"
import { DoorstepApiError } from "../../api/client"
import { decodePartner } from "../model"
import { LENIENT } from "../../model/decode"
import { partnerMobileError } from "@/components/auth/PartnerPhoneExperience"
import { ApplicationCorrections, latestIdentityDocument } from "../ApplicationCorrections"
import type { PartnerDocument } from "../model"

describe("partner intake",()=>{
 test("only returned documents need correction, not already-saved replacements",()=>{
  const proof: PartnerDocument={id:"old",pro_id:"p",kind:"passport",media_id:"m",status:"rejected",reason:"Please upload a readable identity proof",skill_code:null,issued_on:null,expires_on:null,created_at:"2026-10-08T00:00:00Z"}
  const replacement={...proof,id:"new",status:"pending",reason:null,created_at:"2026-10-09T00:00:00Z"}
  expect(latestIdentityDocument([proof,replacement])?.id).toBe("new")
  const q=new QueryClient()
  const render=(items:PartnerDocument[])=>renderToStaticMarkup(<QueryClientProvider client={q}><ApplicationCorrections documents={[...items,{...replacement,id:"selfie",kind:"selfie"}]}/></QueryClientProvider>)
  const rejected=render([proof]);expect(rejected).toContain("Replace your identity proof");expect(rejected).toContain(proof.reason!);expect(rejected).toContain("Submit replacement for review");expect(rejected).not.toContain("PAN number")
  expect(render([proof,replacement])).not.toContain('type="file"');q.clear()
 })
 test("mobile must be a valid Indian number",()=>{expect(partnerMobileError("9876543210")).toBeNull();for(const v of ["","1234567890","98765","98765432101"])expect(partnerMobileError(v)).not.toBeNull()})
 test("application requires identity and supports optional experience without a customer availability gate",()=>{
  const q=new QueryClient();q.setQueryData(["doorstep","partner","signed-out","skills"],[{code:"cleaning",name:"Home cleaning",requires_certificate:false}]);q.setQueryData(["doorstep","partner","signed-out","application-states"],[{code:"36",name:"Telangana"}])
  const html=renderToStaticMarkup(<QueryClientProvider client={q}><PartnerApplication /></QueryClientProvider>)
  for(const copy of ["What work would you like to do?","Home cleaning","State","Town","Bank details","Documents","Review","Continue"])expect(html).toContain(copy)
  expect(html).not.toContain("First name")
  expect(html).not.toContain("Account number *")
  expect(html).not.toContain("No home services available");expect(html).not.toContain("Hyderabad pilot");q.clear()
 })
 test("an application is not verified just because it was submitted",()=>{
  const p=decodePartner({id:"p",user_id:"u",status:"pending_verification",display_name:"Test Partner",city_code:"",gender:null,photo_media_id:null,rating_avg:null,rating_count:0,jobs_completed:0,max_jobs_per_day:6,created_at:"now",updated_at:"now",application:{first_name:"Test",last_name:"Partner",declared_gender:"others",state_code:"36",state_name:"Telangana",town:"Warangal",primary_phone_last4:"3210",alternate_phone_last4:null,alternate_phone_verified_at:null,submitted_at:"now"}},LENIENT)
  const html=renderToStaticMarkup(<ApplicationReceipt partner={p}/>);expect(html).toContain("awaiting verification");expect(html).toContain("after approval");expect(p.application?.town).toBe("Warangal")
  const q=new QueryClient()
  const receipt=renderToStaticMarkup(<QueryClientProvider client={q}><SubmittedApplication partner={p}/></QueryClientProvider>)
  expect(receipt).toContain("submitted together")
  expect(receipt).not.toContain("Save skills")
  expect(receipt).not.toContain("Submit bank details")
  expect(receipt).not.toContain('type="file"')
  q.clear()
 })
 test("partner load failures do not pretend there are no customer services",()=>{
  const html=renderToStaticMarkup(<PartnerErrorState error={new Error("Unavailable")} onRetry={()=>{}}/>);expect(html).toContain("partner details");expect(html).toContain("Try again");expect(html).not.toContain("No home services available")
 })
})
