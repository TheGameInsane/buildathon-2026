import { useState } from "react"
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom"
import { Copy, MoreVertical, Pause, Play } from "lucide-react"
import { cn } from "cn"
import { Breadcrumbs } from "@/components/shell/breadcrumbs"
import { CampaignPauseResumeDialog } from "@/components/campaign-pause-resume-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { StatusPill } from "@/components/status-pill"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaign, useCampaignLifecycle, useToggleCampaignPause } from "@/hooks/use-campaigns"
import { PagePlaceholder } from "@/pages/page-placeholder"
import type { CampaignContext } from "@/pages/use-campaign-context"

const TABS = [
  { to: "overview", label: "Overview" },
  { to: "prospects", label: "Prospects" },
  { to: "agents", label: "Agents" },
  { to: "prompts", label: "Prompts" },
  { to: "knowledge", label: "Knowledge" },
  { to: "settings", label: "Settings" },
] as const

type LifecycleConfirm = { kind: "complete" | "archive" } | null

export function CampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const { data: campaign, isLoading } = useCampaign(campaignId)
  const togglePause = useToggleCampaignPause()
  const lifecycle = useCampaignLifecycle()

  const [pauseConfirm, setPauseConfirm] = useState(false)
  const [lifecycleConfirm, setLifecycleConfirm] = useState<LifecycleConfirm>(null)

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
          <div className="ml-auto flex items-center gap-2">
            {canPause && (
              <Button type="button" variant="outline" size="sm" onClick={() => setPauseConfirm(true)}>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="More campaign actions">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => lifecycle.duplicate.mutate(campaign.id)}>
                  <Copy /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLifecycleConfirm({ kind: "complete" })}>
                  Mark as completed
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setLifecycleConfirm({ kind: "archive" })}>
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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

      <ConfirmDialog
        open={lifecycleConfirm !== null}
        onOpenChange={(open) => !open && setLifecycleConfirm(null)}
        title={lifecycleConfirm?.kind === "archive" ? `Archive ${campaign.name}?` : `Mark ${campaign.name} as completed?`}
        description={
          lifecycleConfirm?.kind === "archive"
            ? "This removes it from Mission Control. It can still be found from Compare and reporting."
            : "This stops active outreach and moves the campaign to Completed."
        }
        confirmLabel={lifecycleConfirm?.kind === "archive" ? "Archive" : "Mark completed"}
        tone={lifecycleConfirm?.kind === "archive" ? "red" : "green"}
        onConfirm={() => {
          if (lifecycleConfirm?.kind === "archive") {
            lifecycle.archive.mutate(campaign.id)
            navigate("/")
          } else if (lifecycleConfirm?.kind === "complete") {
            lifecycle.complete.mutate(campaign.id)
          }
        }}
      />
    </div>
  )
}
