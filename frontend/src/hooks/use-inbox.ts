import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchInboxItems,
  resolveApprovalItem,
  resolveConflictItem,
  resolveEscalationItem,
  type ApprovalResolution,
  type EscalationResolution,
} from "@/api/inbox"

const inboxItemsQueryKey = ["inbox-items"] as const

export function useInboxItems() {
  return useQuery({ queryKey: inboxItemsQueryKey, queryFn: fetchInboxItems })
}

/** Approve/edit/reject all resolve the same way — the item leaves the queue and every count updates live. */
export function useResolveApproval() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: inboxItemsQueryKey })
    queryClient.invalidateQueries({ queryKey: ["inbox-counts"] })
  }

  return useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: ApprovalResolution }) =>
      resolveApprovalItem(id, resolution),
    onSuccess: (_data, { resolution }) => {
      const messages: Record<ApprovalResolution, string> = {
        approve: "Approved, sending now.",
        edit: "Saved and sent your edited version.",
        reject: "Rejected, the Strategy Agent will re-plan.",
      }
      toast.success(messages[resolution])
      invalidate()
    },
  })
}

export function useResolveEscalation() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: inboxItemsQueryKey })
    queryClient.invalidateQueries({ queryKey: ["inbox-counts"] })
  }

  return useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: EscalationResolution }) =>
      resolveEscalationItem(id, resolution),
    onSuccess: (_data, { resolution }) => {
      const messages: Record<EscalationResolution, string> = {
        takeOver: "Reply sent as you.",
        reassign: "Escalation reassigned.",
        dismiss: "Dismissed.",
      }
      toast.success(messages[resolution])
      invalidate()
    },
  })
}

export function useResolveConflict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => resolveConflictItem(id),
    onSuccess: () => {
      toast.success("Conflict resolved.")
      queryClient.invalidateQueries({ queryKey: inboxItemsQueryKey })
      queryClient.invalidateQueries({ queryKey: ["inbox-counts"] })
    },
  })
}
