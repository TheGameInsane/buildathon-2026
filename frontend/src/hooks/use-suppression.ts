import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { deleteSuppressionEntry, fetchSuppressionEntries } from "@/api/suppression"

const suppressionQueryKey = ["suppression-list"] as const

export function useSuppressionEntries() {
  return useQuery({ queryKey: suppressionQueryKey, queryFn: fetchSuppressionEntries })
}

export function useRemoveFromSuppression() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSuppressionEntry,
    onSuccess: () => {
      toast.success("Removed from suppression. Outreach is re-enabled for this prospect.")
      queryClient.invalidateQueries({ queryKey: suppressionQueryKey })
    },
  })
}
