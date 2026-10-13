"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Camera, Video } from "lucide-react"
import { validateImage } from "@/features/doorstep/partner/model"
import { uploadMedia } from "@/lib/mediaUpload"
import api from "@/lib/api"
import "./introduction.css"
import { introductionFileError } from "./introductionRules"

export async function validateIntroduction(file: File) {
  const invalid = introductionFileError(file)
  if (invalid) throw new Error(invalid)
  const url = URL.createObjectURL(file)
  const video = document.createElement("video")
  try {
    const seconds = await new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("We couldn't read this video. Choose another file.")), 15_000)
      video.onloadedmetadata = () => { clearTimeout(timeout); resolve(video.duration) }
      video.onerror = () => { clearTimeout(timeout); reject(new Error("We couldn't read this video. Choose another file.")) }
      video.preload = "metadata"; video.src = url
    })
    const problem = introductionFileError(file, seconds)
    if (problem) throw new Error(problem)
  } finally { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url) }
}
export async function uploadIntroduction(file: File) {
  await validateIntroduction(file)
  return uploadMedia(file, "video", "general")
}

export async function waitForPartnerMedia(mediaId:string) {
  for(let attempt=0;attempt<15;attempt++) {
    const {data}=await api.get<{data:{processing_status:string;moderation_status:string}}>(`/v1/media/${encodeURIComponent(mediaId)}`)
    const media=data.data
    if(media.processing_status==="ready"&&media.moderation_status==="passed")return
    if(media.processing_status==="failed"||media.moderation_status==="rejected")throw new Error("This upload could not be accepted. Choose another file.")
    await new Promise(resolve=>setTimeout(resolve,2000))
  }
  throw new Error("Your upload is still processing. Your details are kept here—try submitting again shortly.")
}

function Preview({file,video=false}:{file:File;video?:boolean}) {
  const [url,setUrl]=useState("")
  useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next)},[file])
  if(!url)return null
  return video ? <video className="partner-introduction__preview" src={url} controls preload="metadata" playsInline/> : <img className="partner-introduction__preview" src={url} alt="Your selected selfie"/>
}

export function IntroductionFields({selfie,video,onSelfie,onVideo,errors={},disabled=false}:{selfie:File|null;video:File|null;onSelfie:(file:File|null)=>void;onVideo:(file:File|null)=>void;errors?:Record<string,string>;disabled?:boolean}) {
  const id=useId()
  const selfieInput=useRef<HTMLInputElement>(null), videoInput=useRef<HTMLInputElement>(null)
  useEffect(()=>{if(!selfie&&selfieInput.current)selfieInput.current.value=""},[selfie])
  useEffect(()=>{if(!video&&videoInput.current)videoInput.current.value=""},[video])
  return <div className="partner-introduction">
    <div className="partner-introduction__grid">
      <section><label htmlFor={`${id}-selfie`}><Camera size={18}/> Selfie <span aria-hidden="true">*</span></label><p id={`${id}-selfie-help`}>A clear photo of your face. No filters or sunglasses.</p>
        <input ref={selfieInput} id={`${id}-selfie`} type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={disabled} aria-required="true" aria-invalid={!!errors.selfie} aria-describedby={`${id}-selfie-help ${id}-selfie-error`} onChange={e=>onSelfie(e.target.files?.[0]??null)}/>
        {selfie && <><Preview file={selfie}/><button type="button" disabled={disabled} onClick={()=>onSelfie(null)}>Remove selfie</button></>}
        <p id={`${id}-selfie-error`} className="partner-introduction__error">{errors.selfie}</p>
      </section>
      <section><label htmlFor={`${id}-video`}><Video size={18}/> Video introduction <small>Optional</small></label><p id={`${id}-video-help`}>Up to one minute about your work, experience and service area. MP4, WebM or MOV · up to 64 MB.</p>
        <input ref={videoInput} id={`${id}-video`} type="file" accept="video/mp4,video/webm,video/quicktime" capture="user" disabled={disabled} aria-describedby={`${id}-video-help ${id}-video-error`} aria-invalid={!!errors.introduction} onChange={e=>onVideo(e.target.files?.[0]??null)}/>
        {video && <><Preview file={video} video/><button type="button" disabled={disabled} onClick={()=>onVideo(null)}>Remove video</button></>}
        <p id={`${id}-video-error`} className="partner-introduction__error">{errors.introduction}</p>
      </section>
    </div>
    <p className="partner-introduction__privacy">Private verification evidence. Not shown on your public profile.</p>
  </div>
}

export function selfieError(file:File|null) { return file ? validateImage(file) : "Add a clear selfie to continue." }
