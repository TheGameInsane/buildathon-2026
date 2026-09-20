import { useState, type MouseEvent, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, GitBranch } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChannelIcon } from "@/components/channel-icon"
import { icons } from "@/lib/tokens"
import { timeAgo } from "@/lib/format"
import type { ApprovalItem, ConflictItem, EscalationItem, PromptApprovalItem } from "@/types/domain"

interface InboxCardBaseProps {
  icon: typeof icons.approval
  accentClassName: string
  iconClassName: string
  context: string
  timestamp: string
  children: ReactNode
  actions: ReactNode
  className?: string
  /** The whole card is this click target; omit while editing so an in-progress draft can't be navigated away from. */
  onCardClick?: () => void
}

/** Shared shape for Approval/Escalation/Conflict/PromptApproval — each varies accent, icon, and buttons. */
function InboxCardBase({
  icon: Icon,
  accentClassName,
  iconClassName,
  context,
  timestamp,
  children,
  actions,
  className,
  onCardClick,
}: InboxCardBaseProps) {
  return (
    <div
      role={onCardClick ? "button" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onClick={onCardClick}
      onKeyDown={
        onCardClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onCardClick()
              }
            }
          : undefined
      }
      className={cn(
        "flex flex-col gap-2 rounded-[10px] border border-border border-l-4 bg-surface p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.02)] transition-shadow hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.6)]",
        onCardClick && "cursor-pointer",
        accentClassName,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
          <Icon className={cn("size-3.5", iconClassName)} />
          {context} · {timeAgo(timestamp)}
        </span>
      </div>
      {children}
      {/* Actions opt out of the card-level click so Approve/Edit/etc. never also navigate. */}
      <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
        {actions}
      </div>
    </div>
  )
}

function stopClick(e: MouseEvent) {
  e.stopPropagation()
}

export interface ApprovalCardProps {
  item: ApprovalItem
  onApprove?: () => void
  /** Fires once the manager clicks Save on the inline editor — re-runs the grounding check before sending. */
  onSaveEdit?: (editedText: string) => void
  onReject?: () => void
  className?: string
}

export function ApprovalCard({ item, onApprove, onSaveEdit, onReject, className }: ApprovalCardProps) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.draftText)
  const openProspect = () => navigate(`/campaigns/${item.campaignId}/prospects/${item.prospectId}`)

  if (editing) {
    return (
      <InboxCardBase
        icon={icons.approval}
        accentClassName="border-l-status-paused"
        iconClassName="text-status-paused"
        context={`${item.prospectName} (${item.company}) · ${item.campaignName}`}
        timestamp={item.timestamp}
        className={className}
        actions={
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onSaveEdit?.(draft)
                setEditing(false)
              }}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(item.draftText)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </>
        }
      >
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} onClick={stopClick} rows={4} autoFocus />
      </InboxCardBase>
    )
  }

  return (
    <InboxCardBase
      icon={icons.approval}
      accentClassName="border-l-status-paused"
      iconClassName="text-status-paused"
      context={`${item.prospectName} (${item.company}) · ${item.campaignName}`}
      timestamp={item.timestamp}
      className={className}
      onCardClick={openProspect}
      actions={
        <>
          <Button type="button" size="sm" onClick={onApprove}>
            Approve
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onReject}>
            Reject
          </Button>
        </>
      }
    >
      <p className="inline-flex items-start gap-1.5 text-sm text-text-primary">
        <ChannelIcon channel={item.channel} className="mt-0.5" />
        <span>"{item.draftText}"</span>
      </p>
      <p className="inline-flex items-center gap-1.5 rounded-md bg-status-paused/10 px-2 py-1 text-xs text-status-paused">
        <AlertTriangle className="size-3.5" />
        {item.flaggedReason}
      </p>
    </InboxCardBase>
  )
}

export interface EscalationCardProps {
  item: EscalationItem
  /** Fires once the manager sends their reply — tagged in the timeline as manager-sent, not agent-sent. */
  onTakeOver?: (replyText: string) => void
  onReassign?: () => void
  onDismiss?: () => void
  className?: string
}

export function EscalationCard({ item, onTakeOver, onReassign, onDismiss, className }: EscalationCardProps) {
  const navigate = useNavigate()
  const [composing, setComposing] = useState(false)
  const [reply, setReply] = useState("")
  const openProspect = () => navigate(`/campaigns/${item.campaignId}/prospects/${item.prospectId}`)

  if (composing) {
    return (
      <InboxCardBase
        icon={AlertTriangle}
        accentClassName="border-l-status-attention"
        iconClassName="text-status-attention"
        context={`${item.prospectName} (${item.company}) · ${item.campaignName}`}
        timestamp={item.timestamp}
        className={className}
        actions={
          <>
            <Button
              type="button"
              size="sm"
              disabled={!reply.trim()}
              onClick={() => {
                onTakeOver?.(reply)
                setComposing(false)
              }}
            >
              Send as yourself
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setComposing(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-primary">{item.reasonText}</p>
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onClick={stopClick}
          placeholder="Reply as yourself…"
          rows={3}
          autoFocus
        />
      </InboxCardBase>
    )
  }

  return (
    <InboxCardBase
      icon={AlertTriangle}
      accentClassName="border-l-status-attention"
      iconClassName="text-status-attention"
      context={`${item.prospectName} (${item.company}) · ${item.campaignName}`}
      timestamp={item.timestamp}
      className={className}
      onCardClick={openProspect}
      actions={
        <>
          <Button type="button" size="sm" onClick={() => setComposing(true)}>
            Take over
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onReassign}>
            Reassign
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-primary">{item.reasonText}</p>
    </InboxCardBase>
  )
}

export interface PromptApprovalCardProps {
  item: PromptApprovalItem
  onApprove?: () => void
  onReject?: () => void
  className?: string
}

/** Prompt Studio's Activate routes here when the campaign requires approval, instead of activating right away. */
export function PromptApprovalCard({ item, onApprove, onReject, className }: PromptApprovalCardProps) {
  const navigate = useNavigate()

  return (
    <InboxCardBase
      icon={icons.promptVersion}
      accentClassName="border-l-brand-600"
      iconClassName="text-brand-600"
      context={`${item.campaignName} · ${item.agentName} Agent`}
      timestamp={item.timestamp}
      className={className}
      onCardClick={() => navigate(`/prompt-studio?campaignId=${item.campaignId}&agent=${encodeURIComponent(item.agentName)}`)}
      actions={
        <>
          <Button type="button" size="sm" onClick={onApprove}>
            Approve and activate
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onReject}>
            Reject
          </Button>
        </>
      }
    >
      <p className="inline-flex items-center gap-1.5 text-sm text-text-primary">
        <GitBranch className="size-4 text-text-secondary" />
        {item.requestedBy} wants to activate v{item.version} for {item.agentName}
      </p>
    </InboxCardBase>
  )
}

export interface ConflictCardProps {
  item: ConflictItem
  onKeepDefault?: () => void
  onOverride?: () => void
  onSlowCadence?: () => void
  className?: string
}

export function ConflictCard({ item, onKeepDefault, onOverride, onSlowCadence, className }: ConflictCardProps) {
  const navigate = useNavigate()

  return (
    <InboxCardBase
      icon={icons.conflict}
      accentClassName="border-l-conflict-accent"
      iconClassName="text-conflict-accent"
      context={`${item.prospectName} in 2 campaigns`}
      timestamp={item.timestamp}
      className={className}
      onCardClick={() => navigate(`/campaigns/${item.campaignId}/prospects/${item.prospectId}`)}
      actions={
        <>
          <Button type="button" size="sm" onClick={onKeepDefault}>
            Keep {item.campaignA.name}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onOverride}>
            Switch to {item.campaignB.name}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSlowCadence}>
            Keep both, slow cadence
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 rounded-md bg-canvas p-2 text-xs sm:grid-cols-2">
        <p>
          <span className="font-medium text-text-primary">{item.campaignA.name}</span> wants to {item.campaignA.wants}
        </p>
        <p>
          <span className="font-medium text-text-primary">{item.campaignB.name}</span> wants to {item.campaignB.wants}
        </p>
      </div>
    </InboxCardBase>
  )
}
