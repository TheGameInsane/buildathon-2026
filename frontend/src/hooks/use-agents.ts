import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { fetchAgents, toggleAgentPause } from "@/api/agents"
import type { Agent } from "@/types/domain"

function agentsQueryKey(campaignId: string) {
  return ["campaigns", campaignId, "agents"] as const
}

export function useAgents(campaignId: string) {
  return useQuery({
    queryKey: agentsQueryKey(campaignId),
    queryFn: () => fetchAgents(campaignId),
  })
}

export function useToggleAgentPause(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (agent: Agent) => toggleAgentPause(campaignId, agent),
    onMutate: async (agent) => {
      await queryClient.cancelQueries({ queryKey: agentsQueryKey(campaignId) })
      const previous = queryClient.getQueryData<Agent[]>(agentsQueryKey(campaignId))
      const nextStatus = agent.status === "active" ? "paused" : "active"

      queryClient.setQueryData<Agent[]>(agentsQueryKey(campaignId), (current) =>
        current?.map((a) => (a.name === agent.name ? { ...a, status: nextStatus } : a)),
      )
      return { previous }
    },
    onError: (_err, agent, context) => {
      queryClient.setQueryData(agentsQueryKey(campaignId), context?.previous)
      toast.error(`Couldn't update ${agent.name}, try again.`)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: agentsQueryKey(campaignId) })
    },
  })
}
