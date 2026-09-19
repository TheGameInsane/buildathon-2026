import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { activatePrompt, fetchActivePromptSummary, fetchPromptVersions, saveDraftPrompt } from "@/api/prompts"
import type { AgentName } from "@/types/domain"

export function useActivePromptSummary(campaignId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "prompts"],
    queryFn: () => fetchActivePromptSummary(campaignId),
  })
}

function versionsQueryKey(campaignId: string, agent: AgentName) {
  return ["campaigns", campaignId, "prompts", agent, "versions"] as const
}

export function usePromptVersions(campaignId: string, agent: AgentName) {
  return useQuery({
    queryKey: versionsQueryKey(campaignId, agent),
    queryFn: () => fetchPromptVersions(campaignId, agent),
  })
}

/** Also used for "Roll back to vN" — activating an older version is the same operation. */
export function useActivatePromptVersion(campaignId: string, agent: AgentName) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (version: number) => activatePrompt(campaignId, agent, version),
    onSuccess: (_data, version) => {
      toast.success(`v${version} is now active for ${agent}.`)
      queryClient.invalidateQueries({ queryKey: versionsQueryKey(campaignId, agent) })
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "prompts"] })
    },
  })
}

/** Edit always saves as a new draft version: versions are append-only, so rollback stays meaningful. */
export function useSaveDraftPrompt(campaignId: string, agent: AgentName, author: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => saveDraftPrompt(campaignId, agent, content, author),
    onSuccess: (draft) => {
      toast.success(`Saved as v${draft.version} (draft).`)
      queryClient.invalidateQueries({ queryKey: versionsQueryKey(campaignId, agent) })
    },
  })
}
