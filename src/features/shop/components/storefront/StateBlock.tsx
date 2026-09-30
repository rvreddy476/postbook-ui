import Link from "next/link"

/**
 * Empty, error and 404 states: one small centred block with a sentence and
 * one action. Same shape everywhere in the zone.
 */
export function StateBlock({ icon, title, text, action }: {
  icon?: React.ReactNode
  title?: string
  text: string
  action?: { label: string; href?: string; onClick?: () => void }
}) {
  return (
    <div className="shop-state" role={title ? undefined : "status"}>
      {icon ? <span className="shop-state__icon">{icon}</span> : null}
      {title ? <h2 className="shop-state__title">{title}</h2> : null}
      <p className="shop-state__text">{text}</p>
      {action?.href ? (
        <Link href={action.href} className="shop-btn shop-btn--outline shop-btn--sm">{action.label}</Link>
      ) : action?.onClick ? (
        <button type="button" onClick={action.onClick} className="shop-btn shop-btn--outline shop-btn--sm">{action.label}</button>
      ) : null}
    </div>
  )
}
