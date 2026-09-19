import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createKnowledgeDoc, fetchKnowledgeDocs } from "@/api/knowledge"

function knowledgeQueryKey(campaignId: string) {
  return ["campaigns", campaignId, "knowledge"] as const
}

export function useKnowledgeDocs(campaignId: string) {
  return useQuery({
    queryKey: knowledgeQueryKey(campaignId),
    queryFn: () => fetchKnowledgeDocs(campaignId),
  })
}

export function useAddKnowledgeDoc(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (doc: Parameters<typeof createKnowledgeDoc>[1]) => createKnowledgeDoc(campaignId, doc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKey(campaignId) })
    },
  })
}
