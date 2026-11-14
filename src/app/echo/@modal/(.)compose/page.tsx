"use client"

import { useRouter } from "next/navigation"

import { ComposeModal } from "@/features/echo/screens"

/* The Post button from any Echo page: the compose modal over that page. */
export default function ComposeInterceptedPage() {
  const router = useRouter()
  return <ComposeModal onClose={() => router.back()} />
}
