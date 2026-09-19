import { useState } from "react"
import { FlaskConical } from "lucide-react"
import { ChannelIcon } from "@/components/channel-icon"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useCampaignLifecycle } from "@/hooks/use-campaigns"
import { useCampaignSettings, useSaveCampaignSettings } from "@/hooks/use-campaign-settings"
import { useCampaignContext } from "@/pages/use-campaign-context"
import type { CampaignSettingsData, Channel, DemoSpeed } from "@/types/domain"

const ALL_CHANNELS: Channel[] = ["email", "whatsapp", "linkedin"]
const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
}

const DEMO_SPEED_LABEL: Record<DemoSpeed, string> = {
  "1h": "1 day = 1 hour",
  "10min": "1 day = 10 min",
  "1min": "1 day = 1 min",
}

function SettingsForm({
  campaignId,
  campaignName,
  initialSettings,
}: {
  campaignId: string
  campaignName: string
  initialSettings: CampaignSettingsData
}) {
  const save = useSaveCampaignSettings(campaignId)
  const lifecycle = useCampaignLifecycle()
  const [form, setForm] = useState(initialSettings)
  const [lifecycleConfirm, setLifecycleConfirm] = useState<"complete" | "archive" | null>(null)

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary">Targeting</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Input
              value={form.targeting.industry}
              onChange={(e) => setForm({ ...form, targeting: { ...form.targeting, industry: e.target.value } })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Geography</Label>
            <Input
              value={form.targeting.geography}
              onChange={(e) => setForm({ ...form, targeting: { ...form.targeting, geography: e.target.value } })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Target roles</Label>
            <Input
              value={form.targeting.targetRoles.join(", ")}
              onChange={(e) =>
                setForm({
                  ...form,
                  targeting: { ...form.targeting, targetRoles: e.target.value.split(",").map((s) => s.trim()) },
                })
              }
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
      </section>

      <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary">Reps</p>
        <div className="flex flex-wrap gap-2">
          {form.reps.map((rep) => (
            <span key={rep.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
              {rep.name}
            </span>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={() => save.mutate(form)} disabled={save.isPending}>
          Save changes
        </Button>
      </div>

      <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <FlaskConical className="size-4" /> Demo speed
        </p>
        <p className="text-xs text-text-secondary">Demo-only setting: speeds up simulated time for presentations.</p>
        <Select
          value={form.demoSpeedMultiplier}
          onValueChange={(v) => {
            const next = { ...form, demoSpeedMultiplier: v as DemoSpeed }
            setForm(next)
            save.mutate(next)
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

      <section className="flex flex-col gap-3 rounded-[10px] border border-status-attention/30 bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary">Campaign lifecycle</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => lifecycle.duplicate.mutate(campaignId)}>
            Duplicate
          </Button>
          <Button type="button" variant="outline" onClick={() => setLifecycleConfirm("complete")}>
            Mark as completed
          </Button>
          <Button type="button" variant="destructive" onClick={() => setLifecycleConfirm("archive")}>
            Archive
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={lifecycleConfirm !== null}
        onOpenChange={(open) => !open && setLifecycleConfirm(null)}
        title={lifecycleConfirm === "archive" ? `Archive ${campaignName}?` : `Mark ${campaignName} as completed?`}
        description={
          lifecycleConfirm === "archive"
            ? "This removes it from Mission Control."
            : "This stops active outreach and moves the campaign to Completed."
        }
        confirmLabel={lifecycleConfirm === "archive" ? "Archive" : "Mark completed"}
        tone={lifecycleConfirm === "archive" ? "red" : "green"}
        onConfirm={() => {
          if (lifecycleConfirm === "archive") lifecycle.archive.mutate(campaignId)
          if (lifecycleConfirm === "complete") lifecycle.complete.mutate(campaignId)
        }}
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

  return <SettingsForm campaignId={campaign.id} campaignName={campaign.name} initialSettings={settings} />
}
