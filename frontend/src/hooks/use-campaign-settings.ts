import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchCampaignSettings, saveCampaignSettings } from "@/api/campaign-settings"
import type { CampaignSettingsData } from "@/types/domain"

function settingsQueryKey(campaignId: string) {
  return ["campaigns", campaignId, "settings"] as const
}

export function useCampaignSettings(campaignId: string) {
  return useQuery({
    queryKey: settingsQueryKey(campaignId),
    queryFn: () => fetchCampaignSettings(campaignId),
  })
}

export function useSaveCampaignSettings(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<CampaignSettingsData>) => saveCampaignSettings(campaignId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKey(campaignId) })
    },
  })
}
