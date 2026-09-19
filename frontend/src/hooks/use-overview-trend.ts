import { useQuery } from "@tanstack/react-query"
import { fetchOverviewTouchesTrend } from "@/api/metrics"
import { overviewTrendPollIntervalMs } from "@/lib/tokens"

/** A trend view, not a live counter: refreshes roughly every 90 minutes, independent of the 5s live poll. */
export function useOverviewTouchesTrend() {
  return useQuery({
    queryKey: ["overview-touches-trend"],
    queryFn: fetchOverviewTouchesTrend,
    refetchInterval: overviewTrendPollIntervalMs,
  })
}
