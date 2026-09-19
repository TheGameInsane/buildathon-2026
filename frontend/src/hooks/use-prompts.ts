import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { activatePrompt, fetchActivePromptSummary, fetchPromptVersions, saveDraftPrompt } from "@/api/prompts"
import type { AgentName, PromptVersion } from "@/types/domain"

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
      // Write the flipped `active` flag straight into the cache: the UI reflects it on this
      // render, instead of waiting on a second round trip from invalidateQueries' refetch.
      queryClient.setQueryData<PromptVersion[]>(versionsQueryKey(campaignId, agent), (current) =>
        current?.map((v) => ({ ...v, active: v.version === version })),
      )
      queryClient.invalidateQueries({ queryKey: versionsQueryKey(campaignId, agent) })
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "prompts"] })
    },
  })
}

/** Edit always saves as a new draft version: versions are append-only, so rollback stays meaningful. */
export function useSaveDraftPrompt(campaignId: string, agent: AgentName, author: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ content, changelog }: { content: string; changelog: string }) =>
      saveDraftPrompt(campaignId, agent, content, author, changelog),
    onSuccess: (draft) => {
      toast.success(`Saved as v${draft.version} (draft).`)
      // Append the new version straight into the cache so it's visible immediately, not only
      // once invalidateQueries' background refetch happens to land.
      queryClient.setQueryData<PromptVersion[]>(versionsQueryKey(campaignId, agent), (current) =>
        current ? [...current, draft] : [draft],
      )
      queryClient.invalidateQueries({ queryKey: versionsQueryKey(campaignId, agent) })
    },
  })
}
