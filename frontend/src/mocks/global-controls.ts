import type { Channel, KillSwitchState } from "@/types/domain"

/** Shared across the top bar and Settings > Global Controls: one kill switch, one truth. */
let killSwitch: KillSwitchState = { active: false, activatedBy: null, activatedAt: null }
let lastDeactivatedAt: string | null = null

export function getKillSwitchState(): KillSwitchState {
  return killSwitch
}

export function getKillSwitchLastDeactivatedAt(): string | null {
  return lastDeactivatedAt
}

export function activateKillSwitch(activatedBy: string): void {
  killSwitch = { active: true, activatedBy, activatedAt: new Date().toISOString() }
}

export function deactivateKillSwitch(): void {
  killSwitch = { active: false, activatedBy: null, activatedAt: null }
  lastDeactivatedAt = new Date().toISOString()
}

const channelPauses: Record<Channel, boolean> = { email: false, whatsapp: false }

export function getChannelPauses(): Record<Channel, boolean> {
  return channelPauses
}

export function setChannelPause(channel: Channel, paused: boolean): void {
  channelPauses[channel] = paused
}
