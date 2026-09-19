import { Fragment } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"

export interface Crumb {
  label: string
  to?: string
}

/** Shown at the top of any screen more than one level from Overview. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-text-secondary">
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <ChevronRight className="size-3.5" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-brand-600 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-text-primary">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
