import type { SpecGroup } from "../../model/catalogue"

/** The spec table, grouped as the server groups it. Nothing for no rows. */
export function Specifications({ groups }: { groups: SpecGroup[] }) {
  if (groups.length === 0) return null
  return (
    <section className="shop-pdp__section" aria-labelledby="shop-specs-title">
      <h2 id="shop-specs-title">Product details</h2>
      <div className="shop-specs">
        {groups.map((group) => (
          <div className="shop-specs__group" key={group.name}>
            {groups.length > 1 || group.name !== "Specifications" ? <h3>{group.name}</h3> : null}
            <dl className="shop-specs__list">
              {group.rows.map((row) => (
                <div key={row.code}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
