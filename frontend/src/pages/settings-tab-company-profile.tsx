import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useCompanyProfile, useSaveCompanyProfile } from "@/hooks/use-company-profile"
import type { CompanyProfile } from "@/api/org"

const EMPTY_PROFILE: CompanyProfile = {
  companyName: "",
  website: "",
  oneLiner: "",
  description: "",
  valueProps: [],
  defaultTone: "",
  brandVoice: "",
  languages: [],
  senderFooter: "",
  unsubscribeText: "",
  disclaimer: "",
}

/** This is the only source of the seller's identity for every generated message
 * (CLAUDE.md: "no company-specific names, facts or prices in code or default
 * prompts") — every campaign's prompts render from this one org-wide row. */
export function SettingsTabCompanyProfile() {
  const { data: profile, isLoading } = useCompanyProfile()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  // Only mounted once `profile` has settled (loading is done above), so the form's
  // initial state is never stale - no effect needed to sync it in after the fact.
  return <CompanyProfileForm initial={profile ?? EMPTY_PROFILE} />
}

function CompanyProfileForm({ initial }: { initial: CompanyProfile }) {
  const save = useSaveCompanyProfile()
  const [form, setForm] = useState<CompanyProfile>(initial)

  const set = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const setList = (key: "valueProps" | "languages", value: string) =>
    set(
      key,
      value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    )

  return (
    <div className="flex max-w-2xl flex-col gap-4 rounded-[10px] border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="company-name">Company name</Label>
          <Input
            id="company-name"
            value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="Acme Logistics"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company-website">Website</Label>
          <Input
            id="company-website"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://acme.example"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="company-one-liner">One-liner</Label>
        <Input
          id="company-one-liner"
          value={form.oneLiner}
          onChange={(e) => set("oneLiner", e.target.value)}
          placeholder="What you do, in one sentence"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="company-description">Description</Label>
        <Textarea
          id="company-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="A short paragraph the AI agents can draw on for context"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="company-value-props">Value props (comma-separated)</Label>
          <Input
            id="company-value-props"
            value={form.valueProps.join(", ")}
            onChange={(e) => setList("valueProps", e.target.value)}
            placeholder="Faster onboarding, Lower cost, ..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company-languages">Languages (comma-separated)</Label>
          <Input
            id="company-languages"
            value={form.languages.join(", ")}
            onChange={(e) => setList("languages", e.target.value)}
            placeholder="en, es"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="company-tone">Default tone</Label>
          <Input
            id="company-tone"
            value={form.defaultTone}
            onChange={(e) => set("defaultTone", e.target.value)}
            placeholder="Professional, direct"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company-brand-voice">Brand voice</Label>
          <Input
            id="company-brand-voice"
            value={form.brandVoice}
            onChange={(e) => set("brandVoice", e.target.value)}
            placeholder="Confident, no jargon"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="company-footer">Sender footer</Label>
        <Textarea
          id="company-footer"
          value={form.senderFooter}
          onChange={(e) => set("senderFooter", e.target.value)}
          placeholder="Appended to every outbound email"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="company-unsubscribe">Unsubscribe text</Label>
          <Input
            id="company-unsubscribe"
            value={form.unsubscribeText}
            onChange={(e) => set("unsubscribeText", e.target.value)}
            placeholder="Reply STOP to unsubscribe"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company-disclaimer">Disclaimer</Label>
          <Input
            id="company-disclaimer"
            value={form.disclaimer}
            onChange={(e) => set("disclaimer", e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!form.companyName.trim() || save.isPending}
          onClick={() => save.mutate(form)}
        >
          {save.isPending ? "Saving…" : "Save company profile"}
        </Button>
      </div>
    </div>
  )
}
