import { Link } from "react-router-dom"
import { LogOut, Settings as SettingsIcon, Sparkles } from "lucide-react"
import { AlertsStrip } from "@/components/shell/alerts-strip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { KillSwitchButton } from "@/components/kill-switch-button"
import type { InboxCounts } from "@/mocks/inbox-counts"

export interface TopBarProps {
  inboxCounts: InboxCounts
  killSwitchActive: boolean
  onActivateKillSwitch: () => void
  managerName: string
}

export function TopBar({ inboxCounts, killSwitchActive, onActivateKillSwitch, managerName }: TopBarProps) {
  const initials = managerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-4 sm:px-6">
      <Link to="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold text-text-primary">
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-cyan shadow-[0_0_12px_-2px_rgba(46,125,255,0.7)]">
          <Sparkles className="size-4 text-white" />
        </span>
        <span className="hidden sm:inline">Autonomous SDR</span>
      </Link>

      <div className="hidden flex-1 justify-center overflow-hidden md:flex">
        <AlertsStrip counts={inboxCounts} variant="compact" />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <KillSwitchButton active={killSwitchActive} onActivate={onActivateKillSwitch} />

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <SettingsIcon /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
