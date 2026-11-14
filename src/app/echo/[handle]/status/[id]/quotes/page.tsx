"use client"

import { useParams } from "next/navigation"

import { QuotesScreen } from "@/features/echo/screens"

/* /echo/<handle>/status/<id>/quotes */
export default function QuotesPage() {
  const params = useParams<{ id: string }>()
  const id = typeof params?.id === "string" ? params.id : ""
  return <QuotesScreen key={id} id={id} />
}
