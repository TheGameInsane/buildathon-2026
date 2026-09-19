import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { fetchInboxCounts } from "@/api/inbox"
import { pollIntervalMs } from "@/lib/tokens"

/** Shared by the top bar, the left rail badge, and Mission Control's alerts strip — one query, one cache entry. */
export function useInboxCounts() {
  return useQuery({
    queryKey: ["inbox-counts"],
    queryFn: fetchInboxCounts,
    refetchInterval: pollIntervalMs,
    placeholderData: keepPreviousData,
  })
}
