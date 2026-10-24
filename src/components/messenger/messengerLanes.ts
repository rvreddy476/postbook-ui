/*
  The messenger's lanes (Direct, Groups, Channels, Requests) and which one
  shows, given which products are open (GET /v1/features, hooks/
  useProductFeatures). A closed product's lane is not offered, and a lane
  asked for by the address (?lane=channels) shows Direct until its product
  opens; the request is kept so the link still lands then. Pure.
*/

export type MessengerLane = 'friends' | 'groups' | 'channels' | 'requests'

export interface LaneChip {
  id: MessengerLane
  label: string
  badge: number
}

export interface LaneAvailability {
  groupsOpen: boolean
  channelsOpen: boolean
}

/** The lane on screen: the requested one, or Direct when its product is closed. */
export function visibleLane(requested: MessengerLane, open: LaneAvailability): MessengerLane {
  if (requested === 'channels' && !open.channelsOpen) return 'friends'
  if (requested === 'groups' && !open.groupsOpen) return 'friends'
  return requested
}

/** The chips, in order. Requests appears only when there is something in it or it is the lane on screen. */
export function laneChips(open: LaneAvailability, requests: { count: number; hidden: number; current: MessengerLane }): LaneChip[] {
  const chips: LaneChip[] = [{ id: 'friends', label: 'Direct', badge: 0 }]
  if (open.groupsOpen) chips.push({ id: 'groups', label: 'Groups', badge: 0 })
  if (open.channelsOpen) chips.push({ id: 'channels', label: 'Channels', badge: 0 })
  if (requests.count > 0 || requests.hidden > 0 || requests.current === 'requests') chips.push({ id: 'requests', label: 'Requests', badge: requests.count })
  return chips
}
