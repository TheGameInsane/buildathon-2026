import { useState } from "react"
import { NavLink, Outlet, useParams } from "react-router-dom"
import { Pause, Play } from "lucide-react"
import { cn } from "cn"
import { Breadcrumbs } from "@/components/shell/breadcrumbs"
import { CampaignPauseResumeDialog } from "@/components/campaign-pause-resume-dialog"
import { StatusPill } from "@/components/status-pill"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaign, useToggleCampaignPause } from "@/hooks/use-campaigns"
import { PagePlaceholder } from "@/pages/page-placeholder"
import type { CampaignContext } from "@/pages/use-campaign-context"

const TABS = [
  { to: "overview", label: "Overview" },
  { to: "prospects", label: "Prospects" },
  { to: "agents", label: "Agents" },
  { to: "prompts", label: "Prompts" },
  { to: "knowledge", label: "Knowledge" },
  { to: "deliverability", label: "Deliverability" },
  { to: "settings", label: "Settings" },
] as const

export function CampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { data: campaign, isLoading } = useCampaign(campaignId)
  const togglePause = useToggleCampaignPause()

  const [pauseConfirm, setPauseConfirm] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
    )
  }

  if (!campaign) {
    return <PagePlaceholder title="Campaign not found" />
  }

  const canPause = campaign.status === "live" || campaign.status === "paused"

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: "Campaigns", to: "/campaigns" }, { label: campaign.name }]} />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">{campaign.name}</h1>
          <StatusPill status={campaign.status} pulse />
          {/* Duplicate/Complete/Archive/Delete live in Settings > Danger zone — visible there, not behind a menu here. */}
          {canPause && (
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setPauseConfirm(true)}>
              {campaign.status === "live" ? (
                <>
                  <Pause /> Pause
                </>
              ) : (
                <>
                  <Play /> Resume
                </>
              )}
            </Button>
          )}
        </div>
        <p className="text-sm text-text-secondary">
          {campaign.icp} · Owner: {campaign.owner} · {campaign.repCount} rep{campaign.repCount === 1 ? "" : "s"}
        </p>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                isActive
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ campaign } satisfies CampaignContext} />

      <CampaignPauseResumeDialog
        action={campaign.status === "live" ? "pause" : "resume"}
        open={pauseConfirm}
        onOpenChange={setPauseConfirm}
        onConfirm={() => togglePause.mutate(campaign)}
      />
    </div>
  )
}
