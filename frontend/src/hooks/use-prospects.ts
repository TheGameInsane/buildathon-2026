import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { discoverProspects, fetchProspects, importProspects } from "@/api/prospects"
import { parseProspectsFile } from "@/lib/parse-prospects-file"

export function useProspects(campaignId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "prospects"],
    queryFn: () => fetchProspects(campaignId),
  })
}

export function useDiscoverProspects() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: discoverProspects,
    onSuccess: (result, campaignId) => {
      toast.success(
        result.imported
          ? `${result.imported} prospect${result.imported === 1 ? "" : "s"} added from ICP discovery.`
          : "ICP discovery finished — no new prospects found.",
      )
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "prospects"] })
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
    },
    onError: () => toast.error("ICP discovery could not be completed. Please try again."),
  })
}

/** "Import prospects" dialog's Upload — parses the CSV/JSON file client-side, then
 * posts the rows to `/prospects/import` (same dedupe-by-email as discovery). */
export function useImportProspects(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => importProspects(campaignId, await parseProspectsFile(file)),
    onSuccess: (result) => {
      toast.success(
        result.imported
          ? `${result.imported} prospect${result.imported === 1 ? "" : "s"} imported.`
          : "Import finished — no new prospects added.",
      )
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "prospects"] })
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
    },
  })
}
