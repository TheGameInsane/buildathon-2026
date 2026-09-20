import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createKnowledgeDoc, fetchKnowledgeDocs, uploadKnowledgeDoc } from "@/api/knowledge"
import type { DocType } from "@/types/domain"

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

export function useUploadKnowledgeDoc(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, docType }: { file: File; docType: DocType }) =>
      uploadKnowledgeDoc(campaignId, file, docType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKey(campaignId) })
    },
  })
}
