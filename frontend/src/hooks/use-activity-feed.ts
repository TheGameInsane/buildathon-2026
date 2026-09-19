import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { fetchActivityFeed } from "@/api/activity-feed"
import { pollIntervalMs } from "@/lib/tokens"

export function useActivityFeed() {
  return useQuery({
    queryKey: ["activity-feed"],
    queryFn: fetchActivityFeed,
    refetchInterval: pollIntervalMs,
    placeholderData: keepPreviousData,
  })
}
