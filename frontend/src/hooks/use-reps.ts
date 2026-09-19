import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createRep,
  fetchRepAssignments,
  fetchReps,
  fetchRepsWithAssignments,
  offboardRep,
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
