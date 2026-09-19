import { useState } from "react"
import { Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { usePlaybook, useSavePlaybook } from "@/hooks/use-playbooks"
import type { PlaybookRule } from "@/types/domain"

function PlaybookForm({ campaignId, initialRules }: { campaignId: string; initialRules: PlaybookRule[] }) {
  const save = useSavePlaybook(campaignId)
  const [rules, setRules] = useState(initialRules)

  function updateRule(id: string, patch: Partial<PlaybookRule>) {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((rule) => rule.id !== id))
  }

  function addRule() {
    setRules((prev) => [...prev, { id: crypto.randomUUID(), trigger: "", action: "" }])
  }

  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Playbooks</p>
          <p className="text-xs text-text-secondary">
            Readable front-end for the Outreach Strategy agent's routing rules.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => save.mutate(rules)} disabled={save.isPending}>
          <Save /> Save
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="px-3 py-2 font-medium">Trigger</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-3 py-2">
                  <Input
                    value={rule.trigger}
                    onChange={(e) => updateRule(rule.id, { trigger: e.target.value })}
                    placeholder="e.g. prospect opens email 2x, no reply"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={rule.action}
                    onChange={(e) => updateRule(rule.id, { action: e.target.value })}
                    placeholder='e.g. move to "high-intent" cadence'
                  />
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove rule"
                    onClick={() => removeRule(rule.id)}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" className="self-start" onClick={addRule}>
        <Plus /> Add rule
      </Button>
    </section>
  )
}

export interface PlaybookCardProps {
  campaignId: string
}

/**
 * Readable, editable front-end for rules that already live in the Outreach Strategy
 * agent's prompt/logic. Each row maps to one branch of its behavior.
 */
export function PlaybookCard({ campaignId }: PlaybookCardProps) {
  const { data: playbook, isLoading } = usePlaybook(campaignId)

  if (isLoading || !playbook) {
    return (
      <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full" />
      </section>
    )
  }

  return <PlaybookForm campaignId={campaignId} initialRules={playbook.rules} />
}
