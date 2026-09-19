import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  activateCampaign,
  archiveCampaign,
  completeCampaign,
  createCampaignFromWizard,
  deleteCampaign,
  duplicateCampaign,
  fetchCampaigns,
  pauseCampaign,
  resumeCampaign,
  submitCampaignCompletionFeedback,
} from "@/api/campaigns"
import { pollIntervalMs } from "@/lib/tokens"
import type { Campaign } from "@/types/domain"

export const campaignsQueryKey = ["campaigns"] as const

/** Overview and the Campaign Overview tab poll every 5s (Design System > Auto-refresh). */
export function useCampaigns() {
  return useQuery({
    queryKey: campaignsQueryKey,
    queryFn: fetchCampaigns,
    refetchInterval: pollIntervalMs,
    placeholderData: keepPreviousData,
  })
}

/** Shares the list query's cache/poll — the Campaign Detail header never issues a second fetch. */
export function useCampaign(campaignId: string | undefined) {
  return useQuery({
    queryKey: campaignsQueryKey,
    queryFn: fetchCampaigns,
    refetchInterval: pollIntervalMs,
    placeholderData: keepPreviousData,
    select: (data) => data.find((c) => c.id === campaignId),
    enabled: campaignId !== undefined,
  })
}

/** Optimistic flip immediately, reconciled on the next poll (Flow 3 — pause mid-execution). */
export function useToggleCampaignPause() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (campaign: Campaign) =>
      campaign.status === "live" ? pauseCampaign(campaign.id) : resumeCampaign(campaign.id),
    onMutate: async (campaign) => {
      await queryClient.cancelQueries({ queryKey: campaignsQueryKey })
      const previous = queryClient.getQueryData<Campaign[]>(campaignsQueryKey)
      const nextStatus = campaign.status === "live" ? "paused" : "live"

      queryClient.setQueryData<Campaign[]>(campaignsQueryKey, (current) =>
        current?.map((c) => (c.id === campaign.id ? { ...c, status: nextStatus } : c)),
      )

      return { previous }
    },
    onError: (_err, campaign, context) => {
      queryClient.setQueryData(campaignsQueryKey, context?.previous)
      toast.error(`Couldn't update ${campaign.name}, try again.`)
    },
    onSuccess: (_data, campaign) => {
      toast.success(`${campaign.name} ${campaign.status === "live" ? "paused" : "resumed"}`)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: campaignsQueryKey })
    },
  })
}

/** Campaign Detail header + Settings tab lifecycle actions (Complete, Archive, Duplicate). */
export function useCampaignLifecycle() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: campaignsQueryKey })

  const complete = useMutation({
    mutationFn: completeCampaign,
    onSuccess: () => {
      toast.success("Campaign marked as completed.")
      invalidate()
    },
  })

  const archive = useMutation({
    mutationFn: archiveCampaign,
    onSuccess: () => {
      toast.success("Campaign archived.")
      invalidate()
    },
  })

  const duplicate = useMutation({
    mutationFn: duplicateCampaign,
    onSuccess: (copy) => {
      toast.success(`Duplicated as "${copy.name}".`)
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      toast.success("Campaign deleted.")
      invalidate()
    },
  })

  return { complete, archive, duplicate, remove }
}

/** Campaign Settings' post-completion feedback modal. */
export function useSubmitCompletionFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ campaignId, text, submittedBy }: { campaignId: string; text: string; submittedBy: string }) =>
      submitCampaignCompletionFeedback(campaignId, text, submittedBy),
    onSuccess: () => {
      toast.success("Thanks, feedback saved on the campaign.")
      queryClient.invalidateQueries({ queryKey: campaignsQueryKey })
    },
  })
}

/** New Campaign Wizard: created once, on arrival at step 6 (Flow 1). */
export function useCreateCampaignFromWizard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCampaignFromWizard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  })
}

/** PreflightChecklist's Activate button, both in the wizard and re-shown later on a Draft. */
export function useActivateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activateCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  })
}
