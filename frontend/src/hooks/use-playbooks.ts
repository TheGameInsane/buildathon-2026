import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { fetchPlaybook, updatePlaybook } from "@/api/playbooks"
import type { PlaybookRule } from "@/types/domain"

function playbookQueryKey(campaignId: string) {
  return ["campaigns", campaignId, "playbook"] as const
}

export function usePlaybook(campaignId: string) {
  return useQuery({ queryKey: playbookQueryKey(campaignId), queryFn: () => fetchPlaybook(campaignId) })
}

export function useSavePlaybook(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rules: PlaybookRule[]) => updatePlaybook(campaignId, rules),
    onSuccess: () => {
      toast.success("Playbook saved.")
      queryClient.invalidateQueries({ queryKey: playbookQueryKey(campaignId) })
    },
  })
}
