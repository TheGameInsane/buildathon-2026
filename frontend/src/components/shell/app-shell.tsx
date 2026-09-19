import { useState } from "react"
import { Outlet } from "react-router-dom"
import { LeftRail } from "@/components/shell/left-rail"
import { TopBar } from "@/components/shell/top-bar"
import { CopilotPanel } from "@/components/shell/copilot-panel"
import { KillSwitchBanner } from "@/components/kill-switch-button"
import { useActivateKillSwitch, useDeactivateKillSwitch, useGlobalControls } from "@/hooks/use-global-controls"
import { useInboxCounts } from "@/hooks/use-inbox-counts"
import { timeAgo } from "@/lib/format"
import { CURRENT_MANAGER_NAME } from "@/lib/current-user"

const EMPTY_COUNTS = { approvals: 0, escalations: 0, conflicts: 0 }

export function AppShell() {
  const [copilotOpen, setCopilotOpen] = useState(false)
  const { data: inboxCounts = EMPTY_COUNTS } = useInboxCounts()
  const { data: globalControls } = useGlobalControls()
  const activateKillSwitch = useActivateKillSwitch()
  const deactivateKillSwitch = useDeactivateKillSwitch()

  const inboxOpenCount = inboxCounts.approvals + inboxCounts.escalations + inboxCounts.conflicts
  const killSwitch = globalControls?.killSwitch

  return (
    <div className="flex h-svh flex-col">
      <TopBar
        inboxCounts={inboxCounts}
        killSwitchActive={killSwitch?.active ?? false}
        onActivateKillSwitch={() => activateKillSwitch.mutate(CURRENT_MANAGER_NAME)}
        managerName={CURRENT_MANAGER_NAME}
      />
      {killSwitch?.active && killSwitch.activatedAt && (
        <KillSwitchBanner
          activatedBy={killSwitch.activatedBy ?? CURRENT_MANAGER_NAME}
          activatedAt={timeAgo(killSwitch.activatedAt)}
          onDeactivate={() => deactivateKillSwitch.mutate()}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <LeftRail inboxOpenCount={inboxOpenCount} />
        <main className="min-w-0 flex-1 overflow-y-auto bg-canvas p-4 sm:p-6">
          <Outlet />
        </main>
        <CopilotPanel open={copilotOpen} onOpenChange={setCopilotOpen} />
      </div>
    </div>
  )
}
