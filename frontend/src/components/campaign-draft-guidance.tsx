import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { PreflightChecklist, type PreflightItem } from "@/components/preflight-checklist"
import { Skeleton } from "@/components/ui/skeleton"
import { useActivateCampaign, useCampaignPreflight } from "@/hooks/use-campaigns"
import { ApiError } from "@/lib/api-client"
import type { Campaign } from "@/types/domain"

/** Where each unmet preflight check gets fixed, when there's a real page for it.
 * `org_active_for_live` has none — org status is platform-admin-only (see
 * scripts/activate_org.py) — so it's shown as plain text with no dead link.
 * `prompts_active` is never false (default templates count as active), so it never
 * needs one either. */
const CHECK_LINKS: Partial<Record<string, { to: string; label: string }>> = {
  company_profile_set: { to: "../settings?section=company", label: "Set company profile" },
  icp_set: { to: "../settings?section=targeting", label: "Set targeting" },
  rep_assigned: { to: "../settings?section=reps", label: "Assign a rep" },
  kb_min_5_docs: { to: "../knowledge", label: "Upload documents" },
  channels_connected: { to: "../settings?section=integrations", label: "Connect a channel" },
}

/** Shown at the top of Overview for any `draft` campaign — turns the real preflight gate
 * (the same one `/activate` enforces, api/campaigns.ts's fetchCampaignPreflight) into a
 * to-do list with a working link or action per item, instead of leaving a manager to
 * discover what's missing only after a 409 from Activate. */
export function CampaignDraftGuidance({ campaign }: { campaign: Campaign }) {
  const { data: preflight, isLoading } = useCampaignPreflight(campaign.id)
  const activate = useActivateCampaign()
  const navigate = useNavigate()

  if (campaign.status !== "draft") return null

  if (isLoading || !preflight) {
    return <Skeleton className="h-28 w-full" />
  }

  const items: PreflightItem[] = preflight.checks.map((check) => {
    if (check.ok) return { label: check.message, passed: true }
    const link = CHECK_LINKS[check.key]
    return {
      label: check.message,
      passed: false,
      actionLabel: link?.label,
      onAction: link ? () => navigate(link.to) : undefined,
    }
  })

  return (
    <div className="rounded-[10px] border border-brand-600/30 bg-brand-50/40 p-4">
      <p className="text-sm font-semibold text-text-primary">
        {preflight.ready ? "Ready to go live" : "This campaign is still a draft"}
      </p>
      <p className="mb-3 text-xs text-text-secondary">
        {preflight.ready
          ? "Every preflight check is green — activate whenever you're ready."
          : "Finish these to activate. Each item links to where it's fixed."}
      </p>
      <PreflightChecklist
        items={items}
        activateLabel="Activate campaign"
        onActivate={() => {
          activate.mutate(campaign.id, {
            onError: (err) => {
              const message = err instanceof ApiError ? err.message : "Could not activate this campaign."
              toast.error(message)
            },
          })
        }}
      />
    </div>
  )
}
