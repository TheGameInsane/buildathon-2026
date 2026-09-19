import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowLeft, Check, Pencil } from "lucide-react"
import { cn } from "cn"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { useCampaigns } from "@/hooks/use-campaigns"
import { useCampaignSettings } from "@/hooks/use-campaign-settings"
import { useRequestPromptApproval } from "@/hooks/use-inbox"
import { useActivatePromptVersion, usePromptVersions, useSaveDraftPrompt } from "@/hooks/use-prompts"
import { useAuth } from "@/hooks/use-auth"
import { timeAgo } from "@/lib/format"
import { AGENT_PIPELINE_ORDER } from "@/types/domain"
import type { AgentName } from "@/types/domain"

function evalScoreClassName(score: number) {
  if (score >= 85) return "text-status-live"
  if (score >= 60) return "text-status-paused"
  return "text-status-attention"
}

/** Asks "what changed in this version" before the draft is created — never a silent save. */
function ChangelogDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (changelog: string) => void
  submitting: boolean
}) {
  const [changelog, setChangelog] = useState("")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setChangelog("")
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What changed in this version?</DialogTitle>
          <DialogDescription>Shown next to this version in the list, so the history stays readable.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="prompt-changelog">Changelog note</Label>
          <Input
            id="prompt-changelog"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="e.g. Tightened the tone guidance for cold outreach"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!changelog.trim() || submitting}
            onClick={() => {
              onConfirm(changelog.trim())
              setChangelog("")
            }}
          >
            Save version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PromptStudioBody({
  campaignId,
  campaignName,
  agent,
  requiresApproval,
}: {
  campaignId: string
  campaignName: string
  agent: AgentName
  requiresApproval: boolean
}) {
  const { user } = useAuth()
  const currentUserName = user?.name ?? ""
  const { data: versions, isLoading } = usePromptVersions(campaignId, agent)
  const activate = useActivatePromptVersion(campaignId, agent)
  const requestApproval = useRequestPromptApproval()
  const saveDraft = useSaveDraftPrompt(campaignId, agent, currentUserName)

  // Oldest first, newest last: reads top-down like a changelog.
  const sorted = useMemo(() => [...(versions ?? [])].sort((a, b) => a.version - b.version), [versions])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState("")
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false)

  if (isLoading || sorted.length === 0) {
    return <Skeleton className="h-96 w-full" />
  }

  const active = sorted.find((v) => v.active) ?? sorted[sorted.length - 1]
  const selected = sorted.find((v) => v.version === selectedVersion) ?? active

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Version list: oldest first, newest last */}
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
              <span className="text-xs text-text-secondary">{timeAgo(v.timestamp)}</span>
              <span className="text-xs text-text-secondary">by {v.author}</span>
              {v.changelog && <span className="text-xs text-text-secondary italic">"{v.changelog}"</span>}
            </button>
          ))}
        </div>

        {/* Full text of the selected version only: no side-by-side comparison. */}
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
                <Button type="button" onClick={() => setChangelogOpen(true)}>
                  Save as new draft
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    v{selected.version}
                    {selected.active && <span className="ml-1.5 text-xs font-normal text-text-secondary">(active)</span>}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {timeAgo(selected.timestamp)}, by {selected.author}
                  </p>
                </div>
                {selected.evalScore > 0 && (
                  <span className={cn("text-xs font-semibold tabular-nums", evalScoreClassName(selected.evalScore))}>
                    eval {selected.evalScore}%
                  </span>
                )}
              </div>
              <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[13px] text-text-primary">
                {selected.content}
              </pre>
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
              <p className="text-xs text-text-secondary">
                Applies going forward only, prospects already in progress under the previous version are not
                retroactively changed.
              </p>
            </div>
          )}
        </div>
      </div>

      <ChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        submitting={saveDraft.isPending}
        onConfirm={(changelog) => {
          saveDraft.mutate(
            { content: draftText, changelog },
            {
              onSuccess: (draft) => {
                setSelectedVersion(draft.version)
                setEditing(false)
                setChangelogOpen(false)
              },
            },
          )
        }}
      />

      <ConfirmDialog
        open={activateConfirmOpen}
        onOpenChange={setActivateConfirmOpen}
        title={
          requiresApproval
            ? `Send v${selected.version} for approval?`
            : `Activate v${selected.version} for ${agent}?`
        }
        description={
          requiresApproval
            ? `This campaign requires approval to activate prompts. v${selected.version} will only go live once approved from the Inbox.`
            : `This will only affect: ${campaignName} / ${agent}. Other campaigns and agents keep their own active version.`
        }
        confirmLabel={requiresApproval ? "Send for approval" : "Activate"}
        tone="green"
        onConfirm={() => {
          if (requiresApproval) {
            requestApproval.mutate({
              campaignId,
              campaignName,
              agentName: agent,
              version: selected.version,
              requestedBy: currentUserName,
            })
          } else {
            activate.mutate(selected.version)
          }
        }}
      />
    </>
  )
}

export function PromptStudio() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns()

  const campaignIdFromUrl = searchParams.get("campaignId")
  const campaignId = campaignIdFromUrl ?? campaigns?.[0]?.id ?? ""
  const agent = (searchParams.get("agent") as AgentName | null) ?? AGENT_PIPELINE_ORDER[0]
  const campaignName = campaigns?.find((c) => c.id === campaignId)?.name ?? ""
  const { data: settings } = useCampaignSettings(campaignId)

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
      {/* Deep-linked from Campaign Detail > Agents/Prompts: keep the way back visible. */}
      {campaignIdFromUrl && (
        <Link
          to={`/campaigns/${campaignIdFromUrl}/prompts`}
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-text-secondary hover:text-brand-600"
        >
          <ArrowLeft className="size-3.5" /> Back to {campaignName || "campaign"}
        </Link>
      )}

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

      <PromptStudioBody
        key={`${campaignId}:${agent}`}
        campaignId={campaignId}
        campaignName={campaignName}
        agent={agent}
        requiresApproval={settings?.requiresApprovalToActivatePrompts ?? false}
      />
    </div>
  )
}
