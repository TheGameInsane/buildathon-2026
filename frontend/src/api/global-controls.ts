import { apiFetch } from "@/lib/api-client"
import type { Channel, KillSwitchState } from "@/types/domain"

/**
 * Wired to `GET/POST /controls` (backend/api/controls.py). The backend only stores a
 * boolean kill switch and a `channel_pauses` map for the org — it doesn't track who
 * flipped it or when, so `activatedBy`/`activatedAt`/`killSwitchLastDeactivatedAt` (all
 * UI-only fields from the old mock) are left null/unknown rather than invented.
 */

export interface GlobalControlsState {
  killSwitch: KillSwitchState
  killSwitchLastDeactivatedAt: string | null
  channelPauses: Record<Channel, boolean>
}

interface ControlsResponse {
  kill_switch: boolean
  channel_pauses: Record<string, boolean>
}

function toChannelPauses(raw: Record<string, boolean>): Record<Channel, boolean> {
  return { email: raw.email ?? false, whatsapp: raw.whatsapp ?? false }
}

/** GET /controls */
export async function fetchGlobalControls(): Promise<GlobalControlsState> {
  const row = await apiFetch<ControlsResponse>("/controls")
  return {
    killSwitch: { active: row.kill_switch, activatedBy: null, activatedAt: null },
    killSwitchLastDeactivatedAt: null,
    channelPauses: toChannelPauses(row.channel_pauses),
  }
}

/** POST /controls — `activatedBy` isn't stored server-side (X-Actor already carries the actor); kept as a parameter only so call sites don't need to change. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function activateKillSwitchRequest(_activatedBy: string): Promise<void> {
  await apiFetch("/controls", { method: "POST", body: { kill_switch: true } })
}

/** POST /controls */
export async function deactivateKillSwitchRequest(): Promise<void> {
  await apiFetch("/controls", { method: "POST", body: { kill_switch: false } })
}

/** POST /controls — `channel_pauses` is a full replace server-side, so merge onto the current row first. */
export async function setChannelPauseRequest(channel: Channel, paused: boolean): Promise<void> {
  const current = await apiFetch<ControlsResponse>("/controls")
  const channelPauses = { ...toChannelPauses(current.channel_pauses), [channel]: paused }
  await apiFetch("/controls", { method: "POST", body: { channel_pauses: channelPauses } })
}
