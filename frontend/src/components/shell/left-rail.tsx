import { NavLink } from "react-router-dom"
import { BarChart3, GitBranch, Inbox as InboxIcon, LayoutDashboard, Megaphone, Settings as SettingsIcon } from "lucide-react"
import { cn } from "cn"

const navItems = [
  { to: "/", label: "Mission Control", icon: LayoutDashboard, end: true },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/inbox", label: "Inbox", icon: InboxIcon },
  { to: "/prompt-studio", label: "Prompt Studio", icon: GitBranch },
  { to: "/compare", label: "Compare", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const

export interface LeftRailProps {
  inboxOpenCount: number
}

/** Always visible on every screen, even inside a modal or a deep page like Prospect 360. */
export function LeftRail({ inboxOpenCount }: LeftRailProps) {
  return (
    <nav className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-3">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={"end" in item ? item.end : false}
          className={({ isActive }) =>
            cn(
              "relative flex w-16 flex-col items-center gap-1 rounded-md px-1 py-2 text-center text-[11px] font-medium transition-colors",
              isActive
                ? "bg-brand-50 text-brand-600 shadow-[inset_0_0_0_1px_rgba(46,125,255,0.2)]"
                : "text-text-secondary hover:bg-canvas hover:text-text-primary",
            )
          }
        >
          <span className="relative">
            <item.icon className="size-5" />
            {item.label === "Inbox" && inboxOpenCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-attention px-1 text-[10px] font-semibold text-white">
                {inboxOpenCount}
              </span>
            )}
          </span>
          <span className="leading-tight">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
