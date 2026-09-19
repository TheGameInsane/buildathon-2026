import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Check, Pencil } from "lucide-react"
import { cn } from "cn"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PromptDiffView } from "@/components/prompt-diff-view"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useCampaigns } from "@/hooks/use-campaigns"
import { useActivatePromptVersion, usePromptVersions, useSaveDraftPrompt } from "@/hooks/use-prompts"
import { timeAgo } from "@/lib/format"
import { CURRENT_MANAGER_NAME } from "@/lib/current-user"
import { AGENT_PIPELINE_ORDER } from "@/types/domain"
import type { AgentName } from "@/types/domain"

function evalScoreClassName(score: number) {
  if (score >= 85) return "text-status-live"
  if (score >= 60) return "text-status-paused"
  return "text-status-attention"
}

function PromptStudioBody({ campaignId, campaignName, agent }: { campaignId: string; campaignName: string; agent: AgentName }) {
  const { data: versions, isLoading } = usePromptVersions(campaignId, agent)
  const activate = useActivatePromptVersion(campaignId, agent)
  const saveDraft = useSaveDraftPrompt(campaignId, agent, CURRENT_MANAGER_NAME)

  const sorted = useMemo(() => [...(versions ?? [])].sort((a, b) => b.version - a.version), [versions])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState("")
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false)

  if (isLoading || sorted.length === 0) {
    return <Skeleton className="h-96 w-full" />
  }

  const active = sorted.find((v) => v.active) ?? sorted[0]
  const selected = sorted.find((v) => v.version === selectedVersion) ?? active

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        {/* Version list */}
        <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-surface p-2">
          {sorted.map((v) => (
            <button
              key={v.version}
              type="button"
              onClick={() => setSelectedVersion(v.version)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left",
                v.version === selected.version ? "bg-brand-50" : "hover:bg-canvas",
              )}
            >
              <span className="inline-flex w-full items-center justify-between text-sm font-medium text-text-primary">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", v.active ? "bg-status-live" : "bg-status-draft")} />
                  v{v.version} {v.active && <span className="text-xs font-normal text-text-secondary">(active)</span>}
                </span>
                <span className={cn("text-xs font-semibold tabular-nums", evalScoreClassName(v.evalScore))}>
                  {v.evalScore > 0 ? `${v.evalScore}%` : "unscored"}
                </span>
              </span>
              <span className="text-xs text-text-secondary">
                {v.author} · {timeAgo(v.timestamp)}
              </span>
            </button>
          ))}
        </div>

        {/* Diff / editor */}
        <div className="rounded-[10px] border border-border bg-surface p-4">
          {editing ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-text-primary">
                Editing v{selected.version}: saves as a new draft version
              </p>
              <Textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={16}
                className="font-mono text-[13px]"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    saveDraft.mutate(draftText, {
                      onSuccess: (draft) => {
                        setSelectedVersion(draft.version)
                        setEditing(false)
                      },
                    })
                  }}
                >
                  Save as new draft
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <PromptDiffView left={selected} right={active} />
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {selected.version !== active.version && (
                  <Button type="button" onClick={() => setActivateConfirmOpen(true)}>
                    <Check /> {selected.version > active.version ? "Activate" : "Roll back to"} v{selected.version}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraftText(selected.content)
                    setEditing(true)
                  }}
                >
                  <Pencil /> Edit v{selected.version}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={activateConfirmOpen}
        onOpenChange={setActivateConfirmOpen}
        title={`Activate v${selected.version} for ${agent}?`}
        description={`This will only affect: ${campaignName} / ${agent}. Other campaigns and agents keep their own active version.`}
        confirmLabel="Activate"
        tone="green"
        onConfirm={() => activate.mutate(selected.version)}
      />
    </>
  )
}

export function PromptStudio() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns()

  const campaignId = searchParams.get("campaignId") ?? campaigns?.[0]?.id ?? ""
  const agent = (searchParams.get("agent") as AgentName | null) ?? AGENT_PIPELINE_ORDER[0]
  const campaignName = campaigns?.find((c) => c.id === campaignId)?.name ?? ""

  if (campaignsLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!campaignId) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center">
        <p className="text-sm text-text-secondary">No campaigns yet, so there's nothing to configure.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">Prompt Studio</h1>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Select value={campaignId} onValueChange={(v) => setSearchParams({ campaignId: v, agent })}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={agent} onValueChange={(v) => setSearchParams({ campaignId, agent: v })}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              {AGENT_PIPELINE_ORDER.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <PromptStudioBody key={`${campaignId}:${agent}`} campaignId={campaignId} campaignName={campaignName} agent={agent} />
    </div>
  )
}
