import type { Channel, Status } from "@/lib/tokens"

export type { Channel, Status }

/** Discovered → Researched → Qualified → Contacted → Engaged → Meeting → Opportunity */
export const FUNNEL_STAGES = [
  "Discovered",
  "Researched",
  "Qualified",
  "Contacted",
  "Engaged",
  "Meeting",
  "Opportunity",
] as const
export type FunnelStage = (typeof FUNNEL_STAGES)[number]

export interface FunnelCounts {
  counts: [number, number, number, number, number, number, number]
}

export interface Campaign {
  id: string
  name: string
  icp: string
  status: Status
  /** Discovered, Researched, Qualified, Contacted, Engaged, Meeting, Opportunity: the single source of truth for every derived count. See src/lib/campaign-metrics.ts. */
  funnelCounts: FunnelCounts["counts"]
  touchCount: number
  todayByChannel: Partial<Record<Channel, number>>
  owner: string
  repCount: number
  lastActivityAt: string
  archived?: boolean
  /** Set once a manager submits the post-completion feedback flow. */
  completionFeedback?: CampaignCompletionFeedback
}

/** One day of the Overview trend chart: total touches sent that day, split by channel, across every campaign. */
export interface DailyChannelTouches {
  day: string
  email: number
  whatsapp: number
}

export type AgentName =
  | "Research"
  | "ICP Fitment"
  | "Outreach Strategy"
  | "Personalisation"
  | "Conversation"
  | "Follow-up"

export const AGENT_PIPELINE_ORDER: AgentName[] = [
  "Research",
  "ICP Fitment",
  "Outreach Strategy",
  "Personalisation",
  "Conversation",
  "Follow-up",
]

export interface Agent {
  name: AgentName
  status: "active" | "paused"
  /** null if this agent has never run for this campaign yet. */
  lastRunAt: string | null
  activeVersion: number
  runsToday: number
  succeeded: number
  failed: number
  avgCost: number
  avgLatencyMs: number
}

export type TimelineEventKind =
  | "sent"
  | "received"
  | "held"
  | "skipped"
  | "escalated"
  | "disqualified"

export interface TimelineEventDetails {
  rawOutput: string
  kbChunksUsed: { title: string; url: string }[]
  tokensIn: number
  tokensOut: number
  cost: number
}

export interface TimelineEvent {
  id: string
  channel: Channel
  kind: TimelineEventKind
  preview: string
  reasonText: string
  groundedOk: boolean | null
  promptVersion: number
  timestamp: string
  details: TimelineEventDetails
  /** Only set on "sent" events: which tier produced this touch. */
  personalizationTier?: PersonalizationTier
}

/**
 * "template" = merge-tag substitution only (LiquidTemplateEngine, no LLM call).
 * "ai" = current Personalisation Agent behaviour (full LLM-generated draft).
 */
export type PersonalizationTier = "template" | "ai"

export interface NextBestAction {
  channel: Channel
  when: string
  intent: string
  reasonText: string
  draftContent?: string
  requiresApproval: boolean
  personalizationTier?: PersonalizationTier
}

export type InboxItemKind = "approval" | "escalation" | "conflict" | "prompt_approval"

export interface InboxItemBase {
  id: string
  kind: InboxItemKind
  prospectName: string
  company: string
  campaignName: string
  /** Lets the Inbox card open the right Prospect 360, its whole surface is one click target. */
  campaignId: string
  prospectId: string
  timestamp: string
}

export interface ApprovalItem extends InboxItemBase {
  kind: "approval"
  channel: Channel
  draftText: string
  flaggedReason: string
}

export interface EscalationItem extends InboxItemBase {
  kind: "escalation"
  reasonText: string
}

export interface ConflictItem extends InboxItemBase {
  kind: "conflict"
  prospectName: string
  campaignA: { name: string; wants: string }
  campaignB: { name: string; wants: string }
}

/** Created when a campaign has "requires approval to activate prompts" on — waits in the Inbox until approved. */
export interface PromptApprovalItem {
  id: string
  kind: "prompt_approval"
  campaignId: string
  campaignName: string
  agentName: AgentName
  version: number
  requestedBy: string
  timestamp: string
}

export type InboxItem = ApprovalItem | EscalationItem | ConflictItem | PromptApprovalItem

export interface PromptVersion {
  version: number
  content: string
  author: string
  timestamp: string
  active: boolean
  evalScore: number
  /** Required on every save: what changed in this version, shown in the version list. */
  changelog: string
}

export interface ActivityFeedEvent {
  id: string
  channel: Channel
  agentName: AgentName
  actionText: string
  campaignId: string
  campaignName: string
  timestamp: string
  prospectId: string
  /** Plain-English reason for this run, shown when the feed item is expanded. */
  reasonText: string
  promptVersion: number
  /** null when this action wasn't a grounding-checkable content generation (e.g. "connection accepted"). */
  groundedOk: boolean | null
}

export interface CampaignMetrics {
  funnelCounts: FunnelCounts["counts"]
  /** Input goal: touches the system sent today, across all channels. */
  touchesSentToday: number
  /** Input goal: prospects the Research agent processed today. */
  prospectsResearchedToday: number
  meetings: number
  meetingsDelta: number
  responseRate: number
  responseRateDelta: number
  costPerQualifiedLead: number
  costPerQualifiedLeadDelta: number
  meetingConversionRate: number
  meetingConversionRateDelta: number
  /** Percentage of touches by channel — sums to ~100. */
  channelMix: Partial<Record<Channel, number>>
  outcomes: { positive: number; negative: number; noReply: number }
}

export type ProspectStatus =
  | "discovered"
  | "contacted"
  | "engaged"
  | "replied"
  | "interested"
  | "meeting_booked"
  | "not_interested"
  | "failed"
  | "paused"

export const PROSPECT_STATUS_LABEL: Record<ProspectStatus, string> = {
  discovered: "Discovered",
  contacted: "Contacted",
  engaged: "Engaged",
  replied: "Replied",
  interested: "Interested",
  meeting_booked: "Meeting booked",
  not_interested: "Not interested",
  failed: "Failed",
  paused: "Paused",
}

export interface KanbanProspect {
  id: string
  name: string
  title: string
  company: string
  /** Reference link only — LinkedIn is not an outreach channel; nothing is sent or received through it. */
  linkedinUrl: string
  fitScore: number
  /** How engaged this prospect has been (opens, clicks, replies), 0-100. Independent of ICP fit. */
  engagementScore: number
  status: ProspectStatus
  daysSinceLastTouch: number
  discoveredAt: string
  lastRepliedAt: string | null
  nextActionChannel?: Channel
  stageIndex: number
  /** When the prospect entered its current stage — the clock an action window counts down from. */
  stageEnteredAt: string
}

export type DocType =
  | "Case study"
  | "Playbook"
  | "Objection handling"
  | "Example email"
  | "ICP definition"

export interface KnowledgeDocument {
  id: string
  title: string
  docType: DocType
  sourceUrl: string
  updatedAt: string
}

export type DemoSpeed = "1h" | "10min" | "1min"

export interface RepRef {
  id: string
  name: string
  email: string
  dailyCap: number
  workingHours: string
  active: boolean
}

export interface RepAssignment {
  campaignId: string
  campaignName: string
}

export interface RepWithAssignments extends RepRef {
  assignments: RepAssignment[]
}

export type SuppressionReason = "unsubscribed" | "bounced" | "manual"

export interface SuppressionEntry {
  id: string
  prospectName: string
  email: string
  reason: SuppressionReason
  addedAt: string
}

export type IntegrationStatus = "connected" | "disconnected"
export type IntegrationMode = "sandbox" | "live"

export interface IntegrationRecord {
  id: string
  name: string
  provider: string
  status: IntegrationStatus
  mode: IntegrationMode
  /** false = no row on the backend yet, this is a placeholder for a provider that's never been connected. */
  configured: boolean
  lastCheckedAt: string | null
}

export interface KillSwitchState {
  active: boolean
  activatedBy: string | null
  activatedAt: string | null
}

export interface CampaignSettingsData {
  targeting: {
    industry: string
    geography: string
    targetRoles: string[]
    companySizeRange: string
    exclusionCriteria: string[]
  }
  channels: {
    enabled: Channel[]
    dailyCaps: Partial<Record<Channel, number>>
    workingHours: string
    timezone: string
    requiresApprovalOnFirstTouch: boolean
    escalateOnPricingOrLegal: boolean
  }
  reps: RepRef[]
  demoSpeedMultiplier: DemoSpeed
  /**
   * When on, activating a new prompt version doesn't apply immediately — it creates an
   * Inbox approval item instead, and only takes effect once approved. Default off.
   */
  requiresApprovalToActivatePrompts: boolean
}

export interface CampaignCompletionFeedback {
  text: string
  submittedBy: string
  submittedAt: string
}

export interface ProspectFact {
  text: string
  sourceUrl: string
}

export type FitVerdictStatus = "fit" | "review" | "no_fit"

export interface ProspectContact {
  email: string
  phone?: string
  whatsapp?: string
  linkedinUrl: string
  location: string
}

export interface ProspectOutreachSummary {
  lastContactedAt: string | null
  touchpointCount: number
  channelsUsed: Channel[]
}

export interface ProspectProfile {
  id: string
  name: string
  title: string
  company: string
  domain: string
  contact: ProspectContact
  outreach: ProspectOutreachSummary
  facts: ProspectFact[]
  fitVerdict: { status: FitVerdictStatus; score: number; reason: string }
  /** Set when this prospect also qualifies in another campaign (Flow 5: conflicts). */
  otherCampaignName?: string
  suppressed: boolean
  /** Set once the prospect has been marked not a fit / stopped. */
  disqualifiedReason?: string
  owningCampaignId: string
  owningCampaignName: string
  assignedRep: string
}

export type NextBestActionState =
  | { kind: "action"; action: NextBestAction }
  | { kind: "researching" }
  | { kind: "none" }
