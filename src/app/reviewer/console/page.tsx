"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ReviewerConsolePage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace("/reviewer")
  }, [router])

  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute h-12 w-12 rounded-full border-4 border-[#2A2740] border-t-brand-accent animate-spin" />
      </div>
      <p className="text-sm font-medium text-[#8B8B9E] dark:text-[#6B6980]">Redirecting to dashboard...</p>
    </div>
  )
}
