"use client"

import { useRef, useState, type FormEvent } from "react"
import api from "@/lib/api"
import { uploadPartnerImage } from "@/features/doorstep/partner/api"
import { IntroductionFields, selfieError, uploadIntroduction, waitForPartnerMedia } from "./IntroductionFields"
import { partnerFailure } from "./api"

export function IntroductionSubmission({module,restaurantId,onSaved}:{module:"ride"|"delivery"|"food";restaurantId?:string;onSaved?:()=>void}) {
  const [selfie,setSelfie]=useState<File|null>(null),[video,setVideo]=useState<File|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false)
  const uploads=useRef(new Map<File,string>()), submitted=useRef(new Set<string>()), lock=useRef(false)
  async function submit(event:FormEvent) {
    event.preventDefault(); if(lock.current)return
    setError("");setSaved(false)
    const invalid=selfieError(selfie);if(invalid){setError(invalid);return}
    lock.current=true;setBusy(true)
    try {
      if(module==="food"&&!restaurantId)throw new Error("Choose your restaurant first.")
      const url=module==="ride"?"/v1/rider/partners/me/documents":module==="delivery"?"/v1/food/delivery/documents":`/v1/food/partner/restaurants/${encodeURIComponent(restaurantId!)}/documents`
      for(const [file,isVideo] of [[selfie!,false],[video,true]] as const) {
        if(!file)continue
        let mediaId=uploads.current.get(file)
        if(!mediaId){mediaId=await (isVideo?uploadIntroduction(file):uploadPartnerImage(file));uploads.current.set(file,mediaId)}
        if(submitted.current.has(mediaId))continue
        await waitForPartnerMedia(mediaId)
        const document_type=module==="ride"?(isVideo?"introduction_video":"profile_photo"):(isVideo?"INTRODUCTION_VIDEO":"SELFIE")
        await api.post(url,{document_type,media_id:mediaId,...(module==="ride"?{file_url:`media://${mediaId}`}:{})})
        submitted.current.add(mediaId)
      }
      setSaved(true);onSaved?.()
    } catch(cause){setError(cause instanceof Error&&!('response' in cause)?cause.message:partnerFailure(cause))}
    finally{lock.current=false;setBusy(false)}
  }
  return <form onSubmit={submit}><h2>Selfie & introduction</h2><IntroductionFields selfie={selfie} video={video} onSelfie={file=>{setSelfie(file);setSaved(false)}} onVideo={file=>{setVideo(file);setSaved(false)}} disabled={busy}/>{error&&<p role="alert">{error}</p>}{saved&&<p role="status">Submitted for verification.</p>}<button type="submit" disabled={busy||saved}>{busy?"Submitting…":"Submit for verification"}</button></form>
}
