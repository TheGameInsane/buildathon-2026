import { Link } from "react-router-dom"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"
import { ChannelIcon } from "@/components/channel-icon"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { GroundedBadge } from "@/components/grounded-badge"
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

/** One line in the Overview live ticker. Click expands the full agent run inline. */
export function ActivityFeedItem({ event }: ActivityFeedItemProps) {
  return (
    <Collapsible className="motion-safe:animate-[activity-feed-in_200ms_ease-out]">
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas",
          "aria-expanded:bg-canvas",
        )}
      >
        <ChannelIcon channel={event.channel} className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1 text-text-primary">
          <span className="font-medium">{event.agentName}</span> {event.actionText}
          <span className="text-text-secondary"> · {event.campaignName} · {timeAgo(event.timestamp)}</span>
        </span>
        <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-text-secondary transition-transform group-aria-expanded:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 rounded-md bg-canvas px-3 py-2.5 text-xs">
        <p className="text-text-primary">
          <span className="font-medium text-text-secondary">Why: </span>
          {event.reasonText}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {event.groundedOk !== null && <GroundedBadge groundedOk={event.groundedOk} />}
          <span className="text-text-secondary">prompt v{event.promptVersion}</span>
        </div>
        <Link
          to={`/campaigns/${event.campaignId}/prospects/${event.prospectId}`}
          className="inline-flex w-fit items-center gap-1 font-medium text-brand-600 hover:underline"
        >
          View prospect's full profile →
        </Link>
      </CollapsibleContent>
    </Collapsible>
  )
}
