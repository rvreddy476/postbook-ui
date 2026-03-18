'use client'

import React from 'react'
import { FolderOpen } from 'lucide-react'
import SpaceCard from '@/components/communities/SpaceCard'
import type { CommunitySpace } from '@/types/communities'

interface SpacesListProps {
  spaces: CommunitySpace[]
  isAdmin?: boolean
  onRemove?: (spaceId: string) => void
  onEdit?: (spaceId: string) => void
}

const SpacesList: React.FC<SpacesListProps> = ({ spaces, isAdmin, onRemove, onEdit }) => {
  if (spaces.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-xl bg-brand-bg mx-auto mb-3 flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-brand-text/30" />
        </div>
        <p className="text-sm text-brand-text/50">No spaces yet</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {spaces.map((space) => (
        <SpaceCard
          key={space.id}
          space={space}
          isAdmin={isAdmin}
          onRemove={onRemove}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}

export default SpacesList
