import { useQuery } from "@tanstack/react-query"
import { fetchDeliverability } from "@/api/deliverability"
import { pollIntervalMs } from "@/lib/tokens"

/** Polls like the Overview tab so the warmup bar visibly climbs during a demo. */
export function useDeliverability(campaignId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "deliverability"],
    queryFn: () => fetchDeliverability(campaignId),
    refetchInterval: pollIntervalMs,
  })
}
