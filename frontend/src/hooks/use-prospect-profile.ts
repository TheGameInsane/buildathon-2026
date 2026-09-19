import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchNextBestActionState,
  fetchProspectProfile,
  fetchProspectTimeline,
  resolveNextBestAction,
} from "@/api/prospect"

export function useProspectProfile(campaignId: string, prospectId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "prospects", prospectId, "profile"],
    queryFn: () => fetchProspectProfile(campaignId, prospectId),
  })
}

export function useProspectTimeline(campaignId: string, prospectId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "prospects", prospectId, "timeline"],
    queryFn: () => fetchProspectTimeline(campaignId, prospectId),
  })
}

function nextActionQueryKey(campaignId: string, prospectId: string) {
  return ["campaigns", campaignId, "prospects", prospectId, "next-action"] as const
}

export function useNextBestActionState(campaignId: string, prospectId: string) {
  return useQuery({
    queryKey: nextActionQueryKey(campaignId, prospectId),
    queryFn: () => fetchNextBestActionState(campaignId, prospectId),
  })
}

export function useResolveNextBestAction(campaignId: string, prospectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: resolveNextBestAction,
    onSuccess: (_data, kind) => {
      const messages = {
        approve: "Approved, sending now.",
        edit: "Saved, sending your edited version.",
        reject: "Rejected, the Strategy Agent will re-plan.",
        skip: "Skipped.",
      } as const
      toast.success(messages[kind])
      queryClient.invalidateQueries({ queryKey: nextActionQueryKey(campaignId, prospectId) })
    },
  })
}
