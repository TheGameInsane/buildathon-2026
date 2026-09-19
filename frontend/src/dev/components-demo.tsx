import { useState } from "react"
import { ActivityFeedItem } from "@/components/activity-feed-item"
import { AgentCard } from "@/components/agent-card"
import { CampaignCard } from "@/components/campaign-card"
import { ChannelBadge, ChannelIcon } from "@/components/channel-icon"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FunnelBar } from "@/components/funnel-bar"
import { GroundedBadge } from "@/components/grounded-badge"
import { ApprovalCard, ConflictCard, EscalationCard } from "@/components/inbox-card"
import { KillSwitchBanner, KillSwitchButton } from "@/components/kill-switch-button"
import { MetricCard } from "@/components/metric-card"
import { NextBestActionCard } from "@/components/next-best-action-card"
import { PreflightChecklist } from "@/components/preflight-checklist"
import { StatusPill } from "@/components/status-pill"
import { TimelineItem } from "@/components/timeline-item"
import { Button } from "@/components/ui/button"
import type {
  Agent,
  ApprovalItem,
  Campaign,
  Channel,
  ConflictItem,
  EscalationItem,
  Status,
  TimelineEvent,
} from "@/types/domain"

const statuses: Status[] = ["live", "paused", "draft", "completed", "attention"]
const channels: Channel[] = ["email", "whatsapp", "linkedin"]

const campaign: Campaign = {
  id: "c1",
  name: "US SaaS CTO Outreach",
  icp: "SaaS CTO · US",
  status: "live",
  funnelCounts: [1284, 1180, 640, 426, 198, 18, 6],
  touchCount: 426,
  todayByChannel: { email: 8, whatsapp: 3, linkedin: 1 },
  owner: "Priya",
  repCount: 3,
  lastActivityAt: new Date(Date.now() - 60_000).toISOString(),
}

const draftCampaign: Campaign = { ...campaign, id: "c2", name: "Existing Customer Expansion", status: "draft" }
const pausedCampaign: Campaign = { ...campaign, id: "c3", name: "AI Founders Outreach", status: "paused" }

const agent: Agent = {
  name: "Personalisation",
  status: "active",
  lastRunAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  activeVersion: 3,
  runsToday: 42,
  succeeded: 40,
  failed: 2,
  avgCost: 0.004,
  avgLatencyMs: 1200,
}

const pausedAgent: Agent = { ...agent, name: "Conversation", status: "paused" }

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: crypto.randomUUID(),
    channel: "email",
    kind: "sent",
    preview: "Following up on Sarvam's speech API credits…",
    reasonText: "Opened first email twice, no reply: trying a different angle before switching channels.",
    groundedOk: true,
    promptVersion: 3,
    timestamp: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
    details: {
      rawOutput: '{"action": "send_email", "confidence": 0.91}',
      kbChunksUsed: [{ title: "Objection handling: pricing", url: "#" }],
      tokensIn: 512,
      tokensOut: 128,
      cost: 0.0041,
    },
    ...overrides,
  }
}

const approvalItem: ApprovalItem = {
  id: "a1",
  kind: "approval",
  prospectName: "Adaline Cho",
  company: "Loop AI",
  campaignName: "US SaaS CTO",
  campaignId: "us-saas-cto",
  prospectId: "us-saas-cto-p4",
  timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  channel: "email",
  draftText: "Following up on pricing, it depends on monthly volume.",
  flaggedReason: "Mentions pricing, needs approval",
}

const escalationItem: EscalationItem = {
  id: "e1",
  kind: "escalation",
  prospectName: "Ravi Menon",
  company: "FinEdge",
  campaignName: "AI Founders Outreach",
  campaignId: "ai-founders-outreach",
  prospectId: "ai-founders-outreach-p2",
  timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  reasonText: "Prospect asked a legal question the agent isn't authorised to answer.",
}

const conflictItem: ConflictItem = {
  id: "co1",
  kind: "conflict",
  prospectName: "Ravi Menon",
  company: "FinEdge",
  campaignName: "AI Founders Outreach",
  campaignId: "ai-founders-outreach",
  prospectId: "ai-founders-outreach-p10",
  timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  campaignA: { name: "AI Founders Outreach", wants: "send email" },
  campaignB: { name: "Existing Customer Expansion", wants: "message on WhatsApp" },
}

const activityFeedTimestamp = new Date(Date.now() - 14 * 1000).toISOString()

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-8">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  )
}

export function ComponentsDemo() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [killSwitchActive, setKillSwitchActive] = useState(false)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold text-text-primary">Component Library: /dev/components</h1>

      <Section title="StatusPill">
        {statuses.map((s) => (
          <StatusPill key={s} status={s} pulse={s === "live"} />
        ))}
        <StatusPill status="attention" label="3 Alerts" />
      </Section>

      <Section title="ChannelIcon / ChannelBadge">
        {channels.map((c) => (
          <ChannelIcon key={c} channel={c} />
        ))}
        {channels.map((c) => (
          <ChannelBadge key={c} channel={c} />
        ))}
        <ChannelBadge channel="linkedin" muted />
      </Section>

      <Section title="CampaignCard">
        <CampaignCard campaign={campaign} className="w-72" onTogglePause={() => {}} />
        <CampaignCard campaign={pausedCampaign} className="w-72" onTogglePause={() => {}} />
        <CampaignCard campaign={draftCampaign} className="w-72" onTogglePause={() => {}} />
      </Section>

      <Section title="FunnelBar">
        <div className="w-full space-y-4">
          <FunnelBar counts={campaign.funnelCounts} variant="mini" />
          <FunnelBar counts={campaign.funnelCounts} variant="full" />
        </div>
      </Section>

      <Section title="AgentCard">
        <AgentCard agent={agent} campaignId={campaign.id} className="w-80" />
        <AgentCard agent={pausedAgent} campaignId={campaign.id} className="w-80" />
      </Section>

      <Section title="TimelineItem">
        <div className="w-full space-y-3">
          <TimelineItem event={makeEvent({})} />
          <TimelineItem
            event={makeEvent({
              kind: "held",
              preview: "",
              reasonText: "Campaign paused",
              groundedOk: null,
            })}
          />
          <TimelineItem
            event={makeEvent({
              kind: "received",
              channel: "whatsapp",
              preview: "Sounds interesting, can you send more detail?",
              reasonText: "",
            })}
          />
          <TimelineItem
            event={makeEvent({
              kind: "escalated",
              preview: "",
              reasonText: "Prospect asked a legal question.",
              groundedOk: null,
            })}
          />
          <TimelineItem event={makeEvent({ groundedOk: false })} />
        </div>
      </Section>

      <Section title="GroundedBadge">
        <GroundedBadge groundedOk />
        <GroundedBadge
          groundedOk={false}
          claims={[
            { text: "\"Used by 500+ companies\" (no source found)", supported: false },
            { text: "\"Series A funded\" (confirmed via Crunchbase)", supported: true },
          ]}
        />
      </Section>

      <Section title="NextBestActionCard">
        <NextBestActionCard
          className="w-80"
          action={{
            channel: "linkedin",
            when: "tomorrow 10am IST",
            intent: "LinkedIn follow-up message",
            reasonText: "Accepted the connection request yesterday",
            requiresApproval: true,
          }}
        />
        <NextBestActionCard
          className="w-80"
          action={{
            channel: "email",
            when: "in 2 days",
            intent: "Follow-up email",
            reasonText: "No reply after 5 days, sending a lighter-touch nudge",
            requiresApproval: false,
          }}
        />
      </Section>

      <Section title="Inbox cards">
        <div className="w-full space-y-3">
          <ApprovalCard item={approvalItem} />
          <EscalationCard item={escalationItem} />
          <ConflictCard item={conflictItem} />
        </div>
      </Section>

      <Section title="KillSwitchButton">
        <KillSwitchButton active={killSwitchActive} onActivate={() => setKillSwitchActive(true)} />
        {killSwitchActive && (
          <div className="w-full">
            <KillSwitchBanner
              onDeactivate={() => setKillSwitchActive(false)}
              activatedBy="Priya"
              activatedAt="just now"
            />
          </div>
        )}
      </Section>

      <Section title="PreflightChecklist">
        <PreflightChecklist
          className="w-96"
          onActivate={() => {}}
          items={[
            { label: "ICP defined", passed: true },
            { label: "Prompts active for all enabled agents", passed: true },
            { label: "Knowledge base has 6 documents (min. 5)", passed: true },
            { label: "Rep assigned", passed: true },
            { label: "Channels connected: Email, WhatsApp", passed: true },
            { label: "Sample message previewed", passed: false, actionLabel: "Preview now" },
          ]}
        />
      </Section>

      <Section title="MetricCard">
        <MetricCard value={18} label="Meetings" delta={4} trend="up" goodDirection="up" />
        <MetricCard value={2.1} label="Cost / qualified lead" delta={-0.3} trend="down" goodDirection="down" format="currency" />
        <MetricCard value={33} label="Response rate" format="percent" />
      </Section>

      <Section title="ActivityFeedItem">
        <div className="w-full">
          <ActivityFeedItem
            event={{
              id: "ev1",
              channel: "whatsapp",
              agentName: "Follow-up",
              actionText: "booked a meeting",
              campaignId: campaign.id,
              campaignName: "BFSI",
              timestamp: activityFeedTimestamp,
              prospectId: "p1",
              reasonText: "Prospect confirmed a time slot after two rounds of scheduling back-and-forth.",
              promptVersion: 2,
              groundedOk: null,
            }}
          />
        </div>
      </Section>

      <Section title="ConfirmDialog">
        <Button onClick={() => setConfirmOpen(true)}>Open confirm dialog</Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Pause US SaaS CTO?"
          description="In-flight actions will be held."
          confirmLabel="Pause"
          tone="amber"
          onConfirm={() => {}}
        />
      </Section>
    </div>
  )
}
