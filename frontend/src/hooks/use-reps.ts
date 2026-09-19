import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  assignRepToCampaignApi,
  createRep,
  fetchRepAssignments,
  fetchReps,
  fetchRepsWithAssignments,
  offboardRep,
  unassignRepFromCampaignApi,
  type OffboardRepInput,
} from "@/api/reps"

const repsQueryKey = ["reps"] as const

export function useReps() {
  return useQuery({ queryKey: repsQueryKey, queryFn: fetchReps })
}

export function useRepsWithAssignments() {
  return useQuery({ queryKey: [...repsQueryKey, "with-assignments"], queryFn: fetchRepsWithAssignments })
}

export function useCreateRep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRep,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: repsQueryKey }),
  })
}

export function useRepAssignments(repId: string | null) {
  return useQuery({
    queryKey: ["reps", repId, "assignments"],
    queryFn: () => fetchRepAssignments(repId!),
    enabled: repId !== null,
  })
}

export function useOffboardRep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OffboardRepInput) => offboardRep(input),
    onSuccess: () => {
      toast.success("Rep offboarded. Affected campaigns have been reassigned.")
      queryClient.invalidateQueries({ queryKey: repsQueryKey })
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
    },
  })
}

/** Campaign Settings > Reps: assign an existing global rep to this one campaign. */
export function useAssignRepToCampaign(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (repId: string) => assignRepToCampaignApi(campaignId, repId),
    onSuccess: () => {
      toast.success("Rep added to campaign.")
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "settings"] })
      queryClient.invalidateQueries({ queryKey: repsQueryKey })
    },
  })
}

/** Campaign Settings > Reps: unassign a rep from this one campaign only (not a global offboard). */
export function useUnassignRepFromCampaign(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (repId: string) => unassignRepFromCampaignApi(campaignId, repId),
    onSuccess: () => {
      toast.success("Rep removed from campaign.")
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "settings"] })
      queryClient.invalidateQueries({ queryKey: repsQueryKey })
    },
  })
}
