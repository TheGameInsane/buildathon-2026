import { Link } from "react-router-dom"
import { ChannelIcon } from "@/components/channel-icon"
import { Skeleton } from "@/components/ui/skeleton"
import { timeAgo } from "@/lib/format"
import type { ActivityFeedEvent } from "@/types/domain"

export interface ActivityFeedItemProps {
  event: ActivityFeedEvent
}

export function ActivityFeedItemSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <Skeleton className="size-4 shrink-0 rounded-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

/** One line in the Mission Control live ticker. New items animate in at the top. */
export function ActivityFeedItem({ event }: ActivityFeedItemProps) {
  return (
    <Link
      to={`/campaigns/${event.campaignId}/prospects/${event.prospectId}`}
      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-canvas motion-safe:animate-[activity-feed-in_200ms_ease-out]"
    >
      <ChannelIcon channel={event.channel} className="mt-0.5" />
      <span className="min-w-0 flex-1 text-text-primary">
        <span className="font-medium">{event.agentName}</span> {event.actionText}
        <span className="text-text-secondary">, {event.campaignName} · {timeAgo(event.timestamp)}</span>
      </span>
    </Link>
  )
}
