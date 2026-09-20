import { useState } from "react"
import { ChannelIcon } from "@/components/channel-icon"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { KillSwitchButton } from "@/components/kill-switch-button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  useActivateKillSwitch,
  useDeactivateKillSwitch,
  useGlobalControls,
  useSetChannelPause,
} from "@/hooks/use-global-controls"
import { useAuth } from "@/hooks/use-auth"
import { timeAgo } from "@/lib/format"
import type { Channel } from "@/types/domain"

const ALL_CHANNELS: Channel[] = ["email", "whatsapp"]
const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
}

export function SettingsTabGlobalControls() {
  const { user } = useAuth()
  const { data, isLoading } = useGlobalControls()
  const activateKillSwitch = useActivateKillSwitch()
  const deactivateKillSwitch = useDeactivateKillSwitch()
  const setChannelPause = useSetChannelPause()
  const [pauseConfirmChannel, setPauseConfirmChannel] = useState<Channel | null>(null)

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const { killSwitch, killSwitchLastDeactivatedAt, channelPauses } = data

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[10px] border border-status-attention/30 bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary">Kill switch</p>
        <p className="text-xs text-text-secondary">
          Stops every autonomous action across every campaign, immediately. This is the same switch shown in the top
          bar on every screen.
        </p>

        {killSwitch.active ? (
          <p className="text-xs text-status-attention">
            Active. Activated by {killSwitch.activatedBy}, {killSwitch.activatedAt && timeAgo(killSwitch.activatedAt)}.
          </p>
        ) : (
          killSwitchLastDeactivatedAt && (
            <p className="text-xs text-text-secondary">Last deactivated {timeAgo(killSwitchLastDeactivatedAt)}.</p>
          )
        )}

        <div className="flex items-center gap-3">
          <KillSwitchButton active={killSwitch.active} onActivate={() => activateKillSwitch.mutate(user?.name ?? "")} />
          {killSwitch.active && (
            <button
              type="button"
              onClick={() => deactivateKillSwitch.mutate()}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Deactivate
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary">Global channel pauses</p>
        <p className="text-xs text-text-secondary">
          Overrides every campaign at once, distinct from pausing a channel within a single campaign's settings.
        </p>
        <div className="flex flex-col gap-2">
          {ALL_CHANNELS.map((channel) => (
            <label key={channel} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span className="inline-flex items-center gap-2 text-sm text-text-primary">
                <ChannelIcon channel={channel} /> {CHANNEL_LABEL[channel]}
              </span>
              <Switch
                checked={channelPauses[channel]}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setPauseConfirmChannel(channel)
                  } else {
                    setChannelPause.mutate({ channel, paused: false })
                  }
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={pauseConfirmChannel !== null}
        onOpenChange={(open) => !open && setPauseConfirmChannel(null)}
        title={`Pause ${pauseConfirmChannel ? CHANNEL_LABEL[pauseConfirmChannel] : ""} globally?`}
        description="This stops this channel across every campaign immediately, until you turn it back on here."
        confirmLabel="Pause channel"
        tone="amber"
        onConfirm={() => pauseConfirmChannel && setChannelPause.mutate({ channel: pauseConfirmChannel, paused: true })}
      />
    </div>
  )
}
