import { useQueries } from "@tanstack/react-query"
import { fetchCampaignMetrics } from "@/api/metrics"
import { graphRefreshIntervalMs } from "@/lib/tokens"

/** Fetches each selected campaign's metrics in parallel, for the Compare screen's
 * table and charts. The Compare screen is a chart view, not a live counter, so it
 * refreshes on the 1-minute graph interval rather than the 5s counter poll. */
export function useCompareMetrics(campaignIds: string[]) {
  return useQueries({
    queries: campaignIds.map((id) => ({
      queryKey: ["campaigns", id, "metrics"],
      queryFn: () => fetchCampaignMetrics(id),
      refetchInterval: graphRefreshIntervalMs,
    })),
    combine: (results) => ({
      data: results.map((r) => r.data),
      isLoading: results.some((r) => r.isLoading),
    }),
  })
}
