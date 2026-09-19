import { delay } from "@/api/delay"
import {
  activateKillSwitch,
  deactivateKillSwitch,
  getChannelPauses,
  getKillSwitchLastDeactivatedAt,
  getKillSwitchState,
  setChannelPause,
} from "@/mocks/global-controls"
import type { Channel, KillSwitchState } from "@/types/domain"

export interface GlobalControlsState {
  killSwitch: KillSwitchState
  killSwitchLastDeactivatedAt: string | null
  channelPauses: Record<Channel, boolean>
}

/** GET /global-controls */
export async function fetchGlobalControls(): Promise<GlobalControlsState> {
  await delay(100)
  return {
    killSwitch: getKillSwitchState(),
    killSwitchLastDeactivatedAt: getKillSwitchLastDeactivatedAt(),
    channelPauses: getChannelPauses(),
  }
}

/** POST /kill-switch/activate */
export async function activateKillSwitchRequest(activatedBy: string): Promise<void> {
  await delay()
  activateKillSwitch(activatedBy)
}

/** POST /kill-switch/deactivate */
export async function deactivateKillSwitchRequest(): Promise<void> {
  await delay()
  deactivateKillSwitch()
}

/** PATCH /global-controls/channels/:channel */
export async function setChannelPauseRequest(channel: Channel, paused: boolean): Promise<void> {
  await delay()
  setChannelPause(channel, paused)
}
