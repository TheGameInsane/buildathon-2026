import { useQuery } from "@tanstack/react-query"
import { fetchProspects } from "@/api/prospects"

export function useProspects(campaignId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "prospects"],
    queryFn: () => fetchProspects(campaignId),
  })
}
