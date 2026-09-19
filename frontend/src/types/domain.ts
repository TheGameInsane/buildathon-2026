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
  sparkline: number[]
  owner: string
  repCount: number
  lastActivityAt: string
  archived?: boolean
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
  lastRunAt: string
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
}

export interface NextBestAction {
  channel: Channel
  when: string
  intent: string
  reasonText: string
  draftContent?: string
  requiresApproval: boolean
}

export type InboxItemKind = "approval" | "escalation" | "conflict"

export interface InboxItemBase {
  id: string
  kind: InboxItemKind
  prospectName: string
  company: string
  campaignName: string
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

export type InboxItem = ApprovalItem | EscalationItem | ConflictItem

export interface PromptVersion {
  version: number
  content: string
  author: string
  timestamp: string
  active: boolean
  evalScore: number
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
}

export interface CampaignMetrics {
  funnelCounts: FunnelCounts["counts"]
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
  fitScore: number
  /** How engaged this prospect has been (opens, clicks, replies), 0-100. Independent of ICP fit. */
  engagementScore: number
  status: ProspectStatus
  daysSinceLastTouch: number
  discoveredAt: string
  lastRepliedAt: string | null
  nextActionChannel?: Channel
  stageIndex: number
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

export interface IntegrationRecord {
  id: string
  name: string
  provider: string
  status: IntegrationStatus
  lastCheckedAt: string
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
