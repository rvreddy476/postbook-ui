import {
  Bell, Bike, CircleHelp, Heart, MessageCircle, Phone, Radio, ShoppingBag,
  Sparkles, User, Users, UtensilsCrossed, Wrench, type LucideIcon,
} from 'lucide-react'
import type { NotificationIcon } from '@/lib/notificationPresentation'

/** The glyph for each server icon key; a row with no actor shows this instead of an avatar. */
export const NOTIFICATION_GLYPHS: Record<NotificationIcon, LucideIcon> = {
  social: Sparkles,
  message: MessageCircle,
  call: Phone,
  live: Radio,
  order: ShoppingBag,
  food: UtensilsCrossed,
  home_service: Wrench,
  ride: Bike,
  dating: Heart,
  community: Users,
  qa: CircleHelp,
  account: User,
  system: Bell,
}

/** A tinted circle with the row's category glyph. `surface` swaps the tint where the row itself is tinted. */
export function NotificationGlyph({ icon, className = 'h-10 w-10', surface = 'bg-primary-tint' }: { icon: NotificationIcon; className?: string; surface?: string }) {
  const Glyph = NOTIFICATION_GLYPHS[icon] ?? Bell
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-primary ${surface} ${className}`}
      data-notification-glyph={icon}
      aria-hidden
    >
      <Glyph className="h-[45%] w-[45%]" strokeWidth={2} />
    </span>
  )
}
