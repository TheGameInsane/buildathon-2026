import { useState } from "react"
import { AlertTriangle, ChevronDown, Clock, XCircle } from "lucide-react"
import { cn } from "cn"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChannelIcon } from "@/components/channel-icon"
import { GroundedBadge } from "@/components/grounded-badge"
import { PersonalizationTierBadge } from "@/components/personalization-tier-badge"
import { timeAgo } from "@/lib/format"
import type { Channel } from "@/lib/tokens"
import type { TimelineEvent } from "@/types/domain"

const channelLabel: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
}

function headerLabel(event: TimelineEvent) {
  switch (event.kind) {
    case "sent":
      return `${channelLabel[event.channel]} sent`
    case "received":
      return `${channelLabel[event.channel]} received`
    case "held":
      return "Held"
    case "skipped":
      return "Skipped"
    case "escalated":
      return "Escalated"
    case "disqualified":
      return "Marked not a fit"
  }
}

const borderColor: Record<TimelineEvent["kind"], string> = {
  sent: "border-l-border",
  received: "border-l-border",
  held: "border-l-status-paused",
  skipped: "border-l-status-paused",
  escalated: "border-l-status-attention",
  disqualified: "border-l-status-draft",
}

export interface TimelineItemProps {
  event: TimelineEvent
  className?: string
}

/** The single most important component: makes Prospect 360 trustworthy. */
export function TimelineItem({ event, className }: TimelineItemProps) {
  const [open, setOpen] = useState(false)
  const isHeldOrSkipped = event.kind === "held" || event.kind === "skipped"

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border-l-4 bg-surface p-4",
        borderColor[event.kind],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary">
          {isHeldOrSkipped ? (
            <Clock className="size-4 text-status-paused" />
          ) : event.kind === "escalated" ? (
            <AlertTriangle className="size-4 text-status-attention" />
          ) : event.kind === "disqualified" ? (
            <XCircle className="size-4 text-status-draft" />
          ) : (
            <ChannelIcon channel={event.channel} />
          )}
          {headerLabel(event)}
        </span>
        <span className="text-xs text-text-secondary">{timeAgo(event.timestamp)}</span>
      </div>

      {event.preview && <p className="text-sm text-text-primary">"{event.preview}"</p>}

      {event.reasonText && (
        <p className="text-xs text-text-secondary">
          <span className="font-medium text-text-primary">Why:</span> {event.reasonText}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        {event.groundedOk !== null && <GroundedBadge groundedOk={event.groundedOk} />}
        {event.personalizationTier && <PersonalizationTierBadge tier={event.personalizationTier} />}
        <span className="text-xs text-text-secondary">prompt v{event.promptVersion}</span>

        <Collapsible open={open} onOpenChange={setOpen} className="ml-auto">
          <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
            Show details
            <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleContent className="mt-1 space-y-2 rounded-md bg-canvas p-3 font-mono text-[13px] text-text-primary">
          <pre className="whitespace-pre-wrap break-words">{event.details.rawOutput}</pre>
          {event.details.kbChunksUsed.length > 0 && (
            <div className="space-y-1">
              <p className="text-text-secondary">Knowledge chunks used:</p>
              <ul className="list-inside list-disc">
                {event.details.kbChunksUsed.map((chunk) => (
                  <li key={chunk.url}>
                    <a href={chunk.url} className="text-brand-600 hover:underline">
                      {chunk.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-text-secondary">
            {event.details.tokensIn} in / {event.details.tokensOut} out tokens, $
            {event.details.cost.toFixed(4)}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
