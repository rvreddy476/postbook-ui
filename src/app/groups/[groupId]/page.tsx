'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

/**
 * Deep links to /groups/<id-or-handle> land in the MySpace layout with
 * the space selected (left rail + in-page space view) instead of a
 * separate detail layout — the left SpaceMenu stays constant on every
 * groups route. Settings lives at /groups/<id>/settings.
 */
export default function GroupDetailRedirect() {
  const params = useParams()
  const router = useRouter()
  const param = params.groupId as string

  useEffect(() => {
    router.replace(`/groups?space=${encodeURIComponent(param)}`)
  }, [router, param])

  return null
}
