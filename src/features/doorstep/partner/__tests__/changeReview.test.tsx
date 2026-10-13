import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WorkingAreaForm } from "../WorkingArea"
import { PartnerReviewRequired, SaveForm } from "../ui"
import { decodeArea } from "../model"
import { LENIENT } from "../../model/decode"

const wrap = (child: React.ReactNode) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{child}</QueryClientProvider>)
test("saved area name is restored into a textbox without exposing coordinate inputs",()=>{
 const area = decodeArea({zone_ids:[],home_lat:17.4,home_lng:78.6,radius_m:8000,area_label:"Uppal, Telangana"},LENIENT)
 const html=wrap(<WorkingAreaForm data={{zones:[],area}}/>)
 expect(html).toContain('value="Uppal, Telangana"')
 expect(html).toContain("Working area")
 expect(html).not.toContain('value="17.4"')
 expect(html).not.toContain('value="78.6"')
})
test("pending area keeps the proposed name visible and cannot submit a replacement",()=>{
 const area=decodeArea({zone_ids:[],home_lat:17.4,home_lng:78.6,radius_m:8000,area_label:"Requested area"},LENIENT)
 const html=wrap(<WorkingAreaForm data={{zones:[],area,pending:true}}/>)
 expect(html).toContain('value="Requested area"')
 expect(html).toContain("awaiting admin approval")
 expect(html).toContain('disabled=""')
})
test("approved partner forms explicitly submit for review, not immediate save",()=>{
 const html=wrap(<PartnerReviewRequired.Provider value={true}><SaveForm save={async()=>undefined}><input aria-label="Name"/></SaveForm></PartnerReviewRequired.Provider>)
 expect(html).toContain("Submit for review")
 expect(html).toContain("Changes take effect after admin approval")
 expect(html).not.toContain("Save &amp; continue")
})
