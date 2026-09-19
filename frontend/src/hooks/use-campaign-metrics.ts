import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { fetchCampaignMetrics } from "@/api/metrics"
import { pollIntervalMs } from "@/lib/tokens"

/** The Campaign Overview tab polls every 5s (Design System > Auto-refresh). */
export function useCampaignMetrics(campaignId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "metrics"],
    queryFn: () => fetchCampaignMetrics(campaignId),
    refetchInterval: pollIntervalMs,
    placeholderData: keepPreviousData,
  })
}
