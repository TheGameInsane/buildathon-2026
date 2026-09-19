import { Link } from "react-router-dom"
import { GitBranch } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useActivePromptSummary } from "@/hooks/use-prompts"
import { timeAgo } from "@/lib/format"
import { useCampaignContext } from "@/pages/use-campaign-context"

/** Kept thin — all real editing happens in Prompt Studio, shared across campaigns. */
export function CampaignPromptsTab() {
  const { campaign } = useCampaignContext()
  const { data: summary, isLoading } = useActivePromptSummary(campaign.id)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-[10px] border border-border bg-surface">
      {summary?.map(({ agent, version }) => (
        <div key={agent} className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">{agent} Agent</p>
            <p className="text-xs text-text-secondary">
              v{version.version} active · last edited by {version.author} · {timeAgo(version.timestamp)}
            </p>
          </div>
          <Link
            to={`/prompt-studio?campaignId=${campaign.id}&agent=${encodeURIComponent(agent)}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
          >
            <GitBranch className="size-3.5" /> View in Prompt Studio
          </Link>
        </div>
      ))}
    </div>
  )
}
