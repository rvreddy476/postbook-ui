'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import GroupPage from '@/components/groups/GroupPage'

// UUID regex to detect whether the param is an ID or a handle
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function GroupDetailPage() {
  const params = useParams()
  const param = params.groupId as string

  const isUUID = UUID_REGEX.test(param)

  return (
    <div className="pt-4">
      <GroupPage groupId={isUUID ? param : undefined} handle={!isUUID ? param : undefined} />
    </div>
  )
}
