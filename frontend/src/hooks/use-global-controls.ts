import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  activateKillSwitchRequest,
  deactivateKillSwitchRequest,
  fetchGlobalControls,
  setChannelPauseRequest,
} from "@/api/global-controls"
import { pollIntervalMs } from "@/lib/tokens"
import type { Channel } from "@/types/domain"

const globalControlsQueryKey = ["global-controls"] as const

/** Shared by the top bar's kill switch and Settings > Global Controls: one query, one truth. */
export function useGlobalControls() {
  return useQuery({
    queryKey: globalControlsQueryKey,
    queryFn: fetchGlobalControls,
    refetchInterval: pollIntervalMs,
  })
}

export function useActivateKillSwitch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activateKillSwitchRequest,
    onSuccess: () => {
      toast.error("Kill switch activated. All campaigns halted.")
      queryClient.invalidateQueries({ queryKey: globalControlsQueryKey })
    },
  })
}

export function useDeactivateKillSwitch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deactivateKillSwitchRequest,
    onSuccess: () => {
      toast.success("Kill switch deactivated.")
      queryClient.invalidateQueries({ queryKey: globalControlsQueryKey })
    },
  })
}

export function useSetChannelPause() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ channel, paused }: { channel: Channel; paused: boolean }) =>
      setChannelPauseRequest(channel, paused),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: globalControlsQueryKey }),
  })
}
