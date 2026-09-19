import { cn } from "cn"
import type { Channel } from "@/lib/tokens"
import { channelIcons } from "@/lib/tokens"

const sizeStyles = {
  sm: "size-3.5",
  md: "size-4",
} as const

export interface ChannelIconProps {
  channel: Channel
  size?: keyof typeof sizeStyles
  /** Greys it out when that channel is paused for the campaign. */
  muted?: boolean
  className?: string
}

export function ChannelIcon({ channel, size = "md", muted, className }: ChannelIconProps) {
  const Icon = channelIcons[channel]
  return (
    <Icon
      className={cn(sizeStyles[size], muted ? "text-text-secondary/40" : "text-text-secondary", className)}
    />
  )
}

const badgeSizeStyles = {
  sm: "size-6",
  md: "size-8",
} as const

export type ChannelBadgeProps = ChannelIconProps

/** ChannelIcon wrapped in a coloured circle, for timelines and funnel breakdowns. */
export function ChannelBadge({ channel, size = "md", muted, className }: ChannelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        badgeSizeStyles[size],
        muted ? "bg-canvas" : "bg-brand-50",
        className,
      )}
    >
      <ChannelIcon
        channel={channel}
        size={size === "sm" ? "sm" : "md"}
        className={muted ? "text-text-secondary/40" : "text-brand-600"}
      />
    </span>
  )
}
