import { useQuery } from "@tanstack/react-query"
import { fetchOverviewTouchesTrend } from "@/api/metrics"
import { graphRefreshIntervalMs } from "@/lib/tokens"

/** A trend view, not a live counter: refreshes every 1 real minute (the product runs
 * on compressed simulated days, so an hour-scale refresh would never fire during a
 * demo), independent of the 5s live poll used for counters/statuses/the activity feed. */
export function useOverviewTouchesTrend() {
  return useQuery({
    queryKey: ["overview-touches-trend"],
    queryFn: fetchOverviewTouchesTrend,
    refetchInterval: graphRefreshIntervalMs,
  })
}
