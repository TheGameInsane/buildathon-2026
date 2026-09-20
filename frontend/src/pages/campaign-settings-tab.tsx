import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Copy, FlaskConical, Radio, Target, UserPlus, Users, X } from "lucide-react"
import { cn } from "cn"
import { ChannelIcon } from "@/components/channel-icon"
import { CampaignCompletionModal } from "@/components/campaign-completion-modal"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiCombobox } from "@/components/ui/multi-combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useCampaignLifecycle, useSubmitCompletionFeedback } from "@/hooks/use-campaigns"
import { useCampaignMetrics } from "@/hooks/use-campaign-metrics"
import { useCampaignSettings, useSaveCampaignSettings } from "@/hooks/use-campaign-settings"
import { useAssignRepToCampaign, useReps, useUnassignRepFromCampaign } from "@/hooks/use-reps"
import { useAuth } from "@/hooks/use-auth"
import { getCampaignFunnelSummary } from "@/lib/campaign-metrics"
import { COUNTRIES } from "@/lib/countries"
import { JOB_TITLE_PRESETS } from "@/lib/job-titles"
import { useCampaignContext } from "@/pages/use-campaign-context"
import type { Campaign, CampaignSettingsData, Channel, DemoSpeed } from "@/types/domain"

const ALL_CHANNELS: Channel[] = ["email", "whatsapp"]
const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
}

const DEMO_SPEED_LABEL: Record<DemoSpeed, string> = {
  "1h": "1 day = 1 hour",
  "10min": "1 day = 10 min",
  "1min": "1 day = 1 min",
}

type SectionKey = "targeting" | "channels" | "reps"

const SECTIONS: { key: SectionKey; label: string; icon: typeof Target }[] = [
  { key: "targeting", label: "Targeting", icon: Target },
  { key: "channels", label: "Channels & policy", icon: Radio },
  { key: "reps", label: "Reps", icon: Users },
]

/** Permanent note next to every save/activate control that changes future behaviour only. */
function PropagationNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-text-secondary", className)}>
      Applies going forward only. Prospects already in progress under the previous configuration are not
      retroactively changed.
    </p>
  )
}

function CampaignRepsSection({ campaignId }: { campaignId: string }) {
  const { data: settings } = useCampaignSettings(campaignId)
  const { data: allReps } = useReps()
  const assign = useAssignRepToCampaign(campaignId)
  const unassign = useUnassignRepFromCampaign(campaignId)
  const [pickerValue, setPickerValue] = useState("")

  const assignedIds = new Set((settings?.reps ?? []).map((r) => r.id))
  const availableReps = (allReps ?? []).filter((r) => r.active && !assignedIds.has(r.id))

  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-text-primary">Reps assigned to this campaign</p>

      <div className="flex flex-col gap-2">
        {(settings?.reps ?? []).length === 0 && <p className="text-xs text-text-secondary">No reps assigned yet.</p>}
        {(settings?.reps ?? []).map((rep) => (
          <div key={rep.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
            <div>
              <p className="text-sm font-medium text-text-primary">{rep.name}</p>
              <p className="text-xs text-text-secondary">{rep.email}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${rep.name} from this campaign`}
              disabled={unassign.isPending}
              onClick={() => unassign.mutate(rep.id)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Select value={pickerValue} onValueChange={setPickerValue}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={availableReps.length ? "Pick a rep to add…" : "No available reps"} />
          </SelectTrigger>
          <SelectContent>
            {availableReps.map((rep) => (
              <SelectItem key={rep.id} value={rep.id}>
                {rep.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={!pickerValue || assign.isPending}
          onClick={() => {
            assign.mutate(pickerValue)
            setPickerValue("")
          }}
        >
          <UserPlus /> Add rep
        </Button>
      </div>
      <p className="text-xs text-text-secondary">
        Need a rep who isn't listed? Add them to the roster from Settings → Reps first.
      </p>
    </section>
  )
}

function SettingsForm({
  campaign,
  initialSettings,
}: {
  campaign: Campaign
  initialSettings: CampaignSettingsData
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  // admin is a superset of manager (spec section 5's role model: "admin - everything").
  const isManager = user?.role === "manager" || user?.role === "admin"
  const save = useSaveCampaignSettings(campaign.id)
  const lifecycle = useCampaignLifecycle()
  const submitFeedback = useSubmitCompletionFeedback()
  const { data: metrics } = useCampaignMetrics(campaign.id)
  const [form, setForm] = useState(initialSettings)
  // ?section= lets other pages deep-link here (campaign-draft-guidance.tsx's
  // "Assign a rep" / "Set targeting" links), falling back to Targeting for a bare visit.
  const [searchParams] = useSearchParams()
  const requestedSection = searchParams.get("section")
  const [section, setSection] = useState<SectionKey>(
    SECTIONS.some((s) => s.key === requestedSection) ? (requestedSection as SectionKey) : "targeting",
  )
  const [lifecycleConfirm, setLifecycleConfirm] = useState<"complete" | "archive" | "delete" | null>(null)
  const [completionModalOpen, setCompletionModalOpen] = useState(false)

  // Only a manager can assign reps to campaigns: reps never see this section at all.
  const visibleSections = isManager ? SECTIONS : SECTIONS.filter((s) => s.key !== "reps")
  const effectiveSection = visibleSections.some((s) => s.key === section) ? section : visibleSections[0].key

  const funnelSummary = getCampaignFunnelSummary(campaign)

  return (
    <div className="flex flex-col gap-4">
      {/* Always visible, not hidden behind a menu or a specially-labeled section. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-surface p-4">
        <div>
          <p className="text-[15px] font-semibold text-text-primary">{campaign.name}</p>
          <p className="text-xs text-text-secondary">
            {campaign.icp}, owner {campaign.owner}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => lifecycle.duplicate.mutate(campaign.id)}>
            <Copy /> Duplicate
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLifecycleConfirm("complete")}>
            Mark as completed
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setLifecycleConfirm("archive")}>
            Archive
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setLifecycleConfirm("delete")}>
            Delete campaign
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {visibleSections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium whitespace-nowrap",
                effectiveSection === s.key
                  ? "bg-brand-50 text-brand-600"
                  : "text-text-secondary hover:bg-canvas hover:text-text-primary",
              )}
            >
              <s.icon className="size-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
        {effectiveSection === "targeting" && (
          <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-text-primary">Targeting</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input
                  value={form.targeting.industry}
                  onChange={(e) => setForm({ ...form, targeting: { ...form.targeting, industry: e.target.value } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Geography</Label>
                <Combobox
                  value={form.targeting.geography}
                  onChange={(v) => setForm({ ...form, targeting: { ...form.targeting, geography: v } })}
                  options={[...COUNTRIES]}
                  placeholder="Search countries…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Target roles</Label>
                <MultiCombobox
                  value={form.targeting.targetRoles}
                  onChange={(v) => setForm({ ...form, targeting: { ...form.targeting, targetRoles: v } })}
                  options={[...JOB_TITLE_PRESETS]}
                  placeholder="CTO, VP Engineering…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Company size range</Label>
                <Input
                  value={form.targeting.companySizeRange}
                  onChange={(e) =>
                    setForm({ ...form, targeting: { ...form.targeting, companySizeRange: e.target.value } })
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <Button
                type="button"
                onClick={() => save.mutate({ targeting: form.targeting })}
                disabled={save.isPending}
                className="w-fit"
              >
                Save changes
              </Button>
              <PropagationNote />
            </div>
          </section>
        )}

        {effectiveSection === "channels" && (
          <>
            <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                <FlaskConical className="size-4" /> Demo speed
              </p>
              <p className="text-xs text-text-secondary">Demo-only setting: speeds up simulated time for presentations.</p>
              <Select
                value={form.demoSpeedMultiplier}
                onValueChange={(v) => {
                  const demoSpeedMultiplier = v as DemoSpeed
                  setForm({ ...form, demoSpeedMultiplier })
                  save.mutate({ demoSpeedMultiplier })
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DEMO_SPEED_LABEL) as DemoSpeed[]).map((speed) => (
                    <SelectItem key={speed} value={speed}>
                      {DEMO_SPEED_LABEL[speed]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-text-primary">Channels & policy</p>
              <div className="flex flex-col gap-2">
                {ALL_CHANNELS.map((channel) => {
                  const enabled = form.channels.enabled.includes(channel)
                  return (
                    <div key={channel} className="flex flex-wrap items-center gap-3">
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          setForm({
                            ...form,
                            channels: {
                              ...form.channels,
                              enabled: checked
                                ? [...form.channels.enabled, channel]
                                : form.channels.enabled.filter((c) => c !== channel),
                            },
                          })
                        }
                      />
                      <ChannelIcon channel={channel} />
                      <span className="w-20 text-sm text-text-primary">{CHANNEL_LABEL[channel]}</span>
                      <Input
                        type="number"
                        disabled={!enabled}
                        value={form.channels.dailyCaps[channel] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            channels: {
                              ...form.channels,
                              dailyCaps: { ...form.channels.dailyCaps, [channel]: Number(e.target.value) },
                            },
                          })
                        }
                        className="w-24"
                        placeholder="Daily cap"
                      />
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Working hours</Label>
                  <Input
                    value={form.channels.workingHours}
                    onChange={(e) => setForm({ ...form, channels: { ...form.channels, workingHours: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Input
                    value={form.channels.timezone}
                    onChange={(e) => setForm({ ...form, channels: { ...form.channels, timezone: e.target.value } })}
                  />
                </div>
              </div>
              <label className="flex items-center justify-between pt-2 text-sm text-text-primary">
                Requires approval on first touch
                <Switch
                  checked={form.channels.requiresApprovalOnFirstTouch}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, channels: { ...form.channels, requiresApprovalOnFirstTouch: checked } })
                  }
                />
              </label>
              <label className="flex items-center justify-between text-sm text-text-primary">
                Escalate on pricing/legal questions
                <Switch
                  checked={form.channels.escalateOnPricingOrLegal}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, channels: { ...form.channels, escalateOnPricingOrLegal: checked } })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-4 pt-2 text-sm text-text-primary">
                <span>
                  Requires approval to activate prompt versions
                  <p className="text-xs font-normal text-text-secondary">
                    When on, Activate in Prompt Studio creates an Inbox approval instead of activating immediately.
                  </p>
                </span>
                <Switch
                  checked={form.requiresApprovalToActivatePrompts}
                  onCheckedChange={(checked) => setForm({ ...form, requiresApprovalToActivatePrompts: checked })}
                />
              </label>
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  onClick={() =>
                    save.mutate({
                      channels: form.channels,
                      requiresApprovalToActivatePrompts: form.requiresApprovalToActivatePrompts,
                    })
                  }
                  disabled={save.isPending}
                  className="w-fit"
                >
                  Save changes
                </Button>
                <PropagationNote />
              </div>
            </section>
          </>
        )}

        {isManager && effectiveSection === "reps" && <CampaignRepsSection campaignId={campaign.id} />}
        </div>
      </div>

      <ConfirmDialog
        open={lifecycleConfirm !== null}
        onOpenChange={(open) => !open && setLifecycleConfirm(null)}
        title={
          lifecycleConfirm === "archive"
            ? `Archive ${campaign.name}?`
            : lifecycleConfirm === "delete"
              ? `Permanently delete ${campaign.name}?`
              : `Mark ${campaign.name} as completed?`
        }
        description={
          lifecycleConfirm === "archive"
            ? "This removes it from Overview. It can still be found from Compare and reporting."
            : lifecycleConfirm === "delete"
              ? "This permanently deletes the campaign and its data. This can't be undone."
              : "This stops active outreach and moves the campaign to Completed."
        }
        confirmLabel={
          lifecycleConfirm === "archive" ? "Archive" : lifecycleConfirm === "delete" ? "Delete permanently" : "Mark completed"
        }
        tone={lifecycleConfirm === "complete" ? "green" : "red"}
        onConfirm={() => {
          if (lifecycleConfirm === "archive") lifecycle.archive.mutate(campaign.id)
          if (lifecycleConfirm === "delete") {
            lifecycle.remove.mutate(campaign.id, { onSuccess: () => navigate("/") })
          }
          if (lifecycleConfirm === "complete") {
            lifecycle.complete.mutate(campaign.id, { onSuccess: () => setCompletionModalOpen(true) })
          }
        }}
      />

      <CampaignCompletionModal
        campaignName={campaign.name}
        open={completionModalOpen}
        onOpenChange={setCompletionModalOpen}
        summary={{
          prospectsProcessed: funnelSummary.discovered,
          touchesSent: campaign.touchCount,
          meetingsBooked: funnelSummary.meetingsBooked,
          responseRate: metrics?.responseRate ?? 0,
          costPerQualifiedLead: metrics?.costPerQualifiedLead ?? 0,
        }}
        submitting={submitFeedback.isPending}
        onSubmit={(text) => submitFeedback.mutate({ campaignId: campaign.id, text, submittedBy: user?.name ?? "" })}
      />
    </div>
  )
}

export function CampaignSettingsTab() {
  const { campaign } = useCampaignContext()
  const { data: settings, isLoading } = useCampaignSettings(campaign.id)

  if (isLoading || !settings) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return <SettingsForm campaign={campaign} initialSettings={settings} />
}
