import { useParams } from "react-router-dom"
import { AlertTriangle, CheckCircle2, HelpCircle, Mail, MapPin, Phone, XCircle } from "lucide-react"
import { cn } from "cn"
import { Breadcrumbs } from "@/components/shell/breadcrumbs"
import { ChannelIcon } from "@/components/channel-icon"
import { LinkedinIcon } from "@/components/icons/linkedin"
import { NextBestActionCard } from "@/components/next-best-action-card"
import { TimelineItem } from "@/components/timeline-item"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaign } from "@/hooks/use-campaigns"
import { timeAgo } from "@/lib/format"
import {
  useNextBestActionState,
  useProspectProfile,
  useProspectTimeline,
  useResolveNextBestAction,
} from "@/hooks/use-prospect-profile"
import { PagePlaceholder } from "@/pages/page-placeholder"
import type { FitVerdictStatus } from "@/types/domain"

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

const VERDICT_META: Record<FitVerdictStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  fit: { icon: CheckCircle2, className: "bg-status-live/10 text-status-live", label: "Fit" },
  review: { icon: HelpCircle, className: "bg-status-paused/10 text-status-paused", label: "Review" },
  no_fit: { icon: XCircle, className: "bg-status-attention/10 text-status-attention", label: "No fit" },
}

function ResearchingIndicator() {
  return (
    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
      Researching
      <span className="flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-text-secondary delay-0" />
        <span className="size-1 animate-bounce rounded-full bg-text-secondary delay-150" />
        <span className="size-1 animate-bounce rounded-full bg-text-secondary delay-300" />
      </span>
    </div>
  )
}

export function Prospect360() {
  const { campaignId, prospectId } = useParams() as { campaignId: string; prospectId: string }
  const { data: campaign } = useCampaign(campaignId)
  const { data: profile, isLoading: profileLoading } = useProspectProfile(campaignId, prospectId)
  const { data: timeline, isLoading: timelineLoading } = useProspectTimeline(campaignId, prospectId)
  const { data: nextAction, isLoading: nextActionLoading } = useNextBestActionState(campaignId, prospectId)
  const resolveAction = useResolveNextBestAction(campaignId, prospectId)

  if (profileLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full lg:col-span-2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!profile || !campaign) {
    return <PagePlaceholder title="Prospect not found" />
  }

  const verdict = VERDICT_META[profile.fitVerdict.status]

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Campaigns", to: "/campaigns" },
          { label: campaign.name, to: `/campaigns/${campaign.id}` },
          { label: "Prospects", to: `/campaigns/${campaign.id}/prospects` },
          { label: profile.name },
        ]}
      />

      {profile.suppressed && (
        <div className="rounded-md bg-status-attention/10 px-3 py-2 text-sm font-medium text-status-attention">
          This prospect is suppressed. No further outreach on any campaign.
        </div>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-4 lg:items-start">
        {/* Left: Research & Fit */}
        <div className="order-2 flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4 lg:order-none">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
              {initials(profile.name)}
            </span>
            <div>
              <p className="text-[15px] font-semibold text-text-primary">{profile.name}</p>
              <p className="text-sm text-text-secondary">
                {profile.title}, {profile.company}
              </p>
              <p className="inline-flex items-center gap-1 text-xs text-text-secondary">
                <MapPin className="size-3" /> {profile.contact.location}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 rounded-md border border-border p-3 text-xs">
            <p className="mb-0.5 font-semibold text-text-primary">Contact</p>
            <a href={`mailto:${profile.contact.email}`} className="inline-flex items-center gap-1.5 text-text-secondary hover:text-brand-600">
              <Mail className="size-3.5" /> {profile.contact.email}
            </a>
            {profile.contact.phone && (
              <a href={`tel:${profile.contact.phone}`} className="inline-flex items-center gap-1.5 text-text-secondary hover:text-brand-600">
                <Phone className="size-3.5" /> {profile.contact.phone}
              </a>
            )}
            {profile.contact.whatsapp && (
              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                <ChannelIcon channel="whatsapp" /> {profile.contact.whatsapp}
              </span>
            )}
            <a
              href={profile.contact.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-text-secondary hover:text-brand-600"
            >
              <LinkedinIcon className="size-3.5" /> LinkedIn profile
            </a>
          </div>

          <div className="flex flex-col gap-1.5 rounded-md border border-border p-3 text-xs">
            <p className="mb-0.5 font-semibold text-text-primary">Outreach</p>
            <p className="text-text-secondary">
              Campaign: <span className="text-text-primary">{profile.owningCampaignName}</span>
            </p>
            <p className="text-text-secondary">
              Last contacted:{" "}
              <span className="text-text-primary">
                {profile.outreach.lastContactedAt ? timeAgo(profile.outreach.lastContactedAt) : "Not yet contacted"}
              </span>
            </p>
            <p className="text-text-secondary">
              Touchpoints: <span className="text-text-primary">{profile.outreach.touchpointCount}</span>
            </p>
            <p className="inline-flex items-center gap-1.5 text-text-secondary">
              Channels used:
              {profile.outreach.channelsUsed.map((c) => (
                <ChannelIcon key={c} channel={c} />
              ))}
            </p>
          </div>

          <div className={cn("flex items-start gap-2 rounded-md p-2", verdict.className)}>
            <verdict.icon className="mt-0.5 size-4 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold">
                Fit: {profile.fitVerdict.score}/100 ({verdict.label})
              </p>
              <p>{profile.fitVerdict.reason}</p>
            </div>
          </div>

          {profile.otherCampaignName && (
            <p className="inline-flex items-start gap-1.5 rounded-md bg-status-paused/10 p-2 text-xs text-status-paused">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Also in: {profile.otherCampaignName}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            {profile.facts.map((fact, i) => (
              <p key={i} className="text-xs text-text-secondary">
                {fact.text}{" "}
                <a href={fact.sourceUrl} className="text-brand-600 hover:underline">
                  [source]
                </a>
              </p>
            ))}
          </div>
        </div>

        {/* Centre: Timeline */}
        <div className="order-3 flex flex-col gap-3 lg:order-none lg:col-span-2">
          {timelineLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            timeline?.map((event) => <TimelineItem key={event.id} event={event} />)
          )}
        </div>

        {/* Right: Next Best Action */}
        <div className="order-1 flex flex-col gap-3 lg:order-none">
          {nextActionLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : nextAction?.kind === "action" ? (
            <NextBestActionCard
              action={nextAction.action}
              onApprove={() => resolveAction.mutate("approve")}
              onEdit={() => resolveAction.mutate("edit")}
              onSkip={() => resolveAction.mutate("skip")}
            />
          ) : nextAction?.kind === "researching" ? (
            <div className="rounded-[10px] border border-border bg-surface p-4">
              <p className="mb-2 text-[15px] font-semibold text-text-primary">Next Best Action</p>
              <ResearchingIndicator />
            </div>
          ) : null}

          <div className="rounded-[10px] border border-border bg-surface p-4 text-xs text-text-secondary">
            <p>
              Owning campaign: <span className="font-medium text-text-primary">{profile.owningCampaignName}</span>
            </p>
            <p>
              Rep: <span className="font-medium text-text-primary">{profile.assignedRep}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
