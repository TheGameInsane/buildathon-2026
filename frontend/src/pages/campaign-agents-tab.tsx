import { AgentCard } from "@/components/agent-card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgents, useToggleAgentPause } from "@/hooks/use-agents"
import { useCampaignContext } from "@/pages/use-campaign-context"

export function CampaignAgentsTab() {
  const { campaign } = useCampaignContext()
  const { data: agents, isLoading } = useAgents(campaign.id)
  const togglePause = useToggleAgentPause(campaign.id)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents?.map((agent) => (
        <AgentCard
          key={agent.name}
          agent={agent}
          campaignId={campaign.id}
          onTogglePause={(a) => togglePause.mutate(a)}
        />
      ))}
    </div>
  )
}
