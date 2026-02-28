'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import GroupPage from '@/components/groups/GroupPage'

export default function GroupDetailPage() {
  const params = useParams()
  const groupId = params.groupId as string

  return (
    <div className="pt-4">
      <GroupPage groupId={groupId} />
    </div>
  )
}
