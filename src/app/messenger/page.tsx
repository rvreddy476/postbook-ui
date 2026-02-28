'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/services/authService'
import { NotificationProvider } from '@/contexts/NotificationContext'
import PostbookMessenger from '@/components/messenger/PostbookMessenger'
import type { User } from '@/types'

export default function MessengerPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const user = getSession()
    if (!user) {
      router.push('/')
      return
    }
    setCurrentUser(user)
    setLoaded(true)
  }, [router])

  if (!loaded || !currentUser) {
    return <div style={{ height: '100vh', background: '#0d0d1a' }} />
  }

  return (
    <NotificationProvider currentUserId={currentUser.id} onOpenChat={() => {}}>
      <PostbookMessenger />
    </NotificationProvider>
  )
}
