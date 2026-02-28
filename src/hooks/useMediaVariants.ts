"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"

export interface MediaVariantInfo {
  variant: string
  width?: number
  height?: number
  mime?: string
}

export interface MediaInfo {
  id: string
  file_type: string
  processing_status: string
  width?: number
  height?: number
  duration_seconds?: number
  variants: MediaVariantInfo[]
}

const VIDEO_QUALITIES = ["360p", "480p", "720p", "1080p", "4k"]

export function useMediaVariants(mediaId: string | undefined, enabled = false) {
  return useQuery({
    queryKey: ["media-variants", mediaId],
    queryFn: async () => {
      const res = await api.get<{ data: MediaInfo }>(`/v1/media/${mediaId}`)
      const data = res.data.data
      const available = (data.variants || [])
        .filter((v) => VIDEO_QUALITIES.includes(v.variant))
        .map((v) => v.variant)
        .sort((a, b) => {
          const order = VIDEO_QUALITIES
          return order.indexOf(a) - order.indexOf(b)
        })
      return {
        ...data,
        availableQualities: [...available, "auto"],
      }
    },
    enabled: !!mediaId && enabled,
    staleTime: 5 * 60 * 1000,
  })
}
