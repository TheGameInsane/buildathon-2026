import { useState } from "react"
import { UserMinus, UserPlus } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { useCreateRep, useOffboardRep, useReps, useRepsWithAssignments } from "@/hooks/use-reps"
import type { RepWithAssignments } from "@/types/domain"

function AddRepDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const createRep = useCreateRep()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setName("")
      }}
    >
      <Button type="button" onClick={() => setOpen(true)}>
        <UserPlus /> Add rep
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a rep</DialogTitle>
          <DialogDescription>Adds them to the global roster, available to assign to any campaign.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-rep-name">Name</Label>
          <Input id="new-rep-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || createRep.isPending}
            onClick={() => {
              createRep.mutate(name.trim(), {
                onSuccess: () => {
                  setName("")
                  setOpen(false)
                },
              })
            }}
          >
            Add rep
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OffboardDialog({ rep, onClose }: { rep: RepWithAssignments; onClose: () => void }) {
  const { data: allReps } = useReps()
  const offboard = useOffboardRep()
  const [replacements, setReplacements] = useState<Record<string, string | null>>({})

  const otherActiveReps = allReps?.filter((r) => r.id !== rep.id && r.active) ?? []

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Offboard {rep.name}?</DialogTitle>
          <DialogDescription>
            {rep.assignments.length > 0
              ? `${rep.name} is assigned to ${rep.assignments.length} campaign${rep.assignments.length === 1 ? "" : "s"}. Pick a replacement for each, or leave unassigned.`
              : `${rep.name} isn't assigned to any campaigns. This will mark them inactive.`}
          </DialogDescription>
        </DialogHeader>

        {rep.assignments.length > 0 && (
          <div className="flex flex-col gap-2">
            {rep.assignments.map((a) => (
              <div key={a.campaignId} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                <span className="min-w-0 truncate text-sm text-text-primary">{a.campaignName}</span>
                <Select
                  value={replacements[a.campaignId] ?? "__unassigned"}
                  onValueChange={(v) =>
                    setReplacements((prev) => ({ ...prev, [a.campaignId]: v === "__unassigned" ? null : v }))
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned">Leave unassigned</SelectItem>
                    {otherActiveReps.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              offboard.mutate(
                {
                  repId: rep.id,
                  reassignments: rep.assignments.map((a) => ({
                    campaignId: a.campaignId,
                    newRepId: replacements[a.campaignId] ?? null,
                  })),
                },
                { onSuccess: onClose },
              )
            }}
          >
            Offboard rep
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SettingsTabReps() {
  const { data: reps, isLoading } = useRepsWithAssignments()
  const [offboardTarget, setOffboardTarget] = useState<RepWithAssignments | null>(null)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Skeleton className="h-8 w-28" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <AddRepDialog />
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="px-4 py-3 font-medium">Rep</th>
              <th className="px-4 py-3 font-medium">Assigned campaigns</th>
              <th className="px-4 py-3 font-medium">Daily cap</th>
              <th className="px-4 py-3 font-medium">Working hours</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {reps?.map((rep) => (
              <tr key={rep.id} className="hover:bg-canvas">
                <td className="px-4 py-3">
                  <p className="font-medium text-text-primary">{rep.name}</p>
                  <p className="text-xs text-text-secondary">{rep.email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {rep.assignments.length === 0 ? (
                      <span className="text-xs text-text-secondary">None</span>
                    ) : (
                      rep.assignments.map((a) => (
                        <span key={a.campaignId} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                          {a.campaignName}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-text-secondary">{rep.dailyCap}/day</td>
                <td className="px-4 py-3 text-text-secondary">{rep.workingHours}</td>
                <td className="px-4 py-3">
                  <Switch checked={rep.active} disabled={!rep.active} />
                </td>
                <td className="px-4 py-3">
                  {rep.active && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setOffboardTarget(rep)}>
                      <UserMinus /> Offboard
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {offboardTarget && <OffboardDialog rep={offboardTarget} onClose={() => setOffboardTarget(null)} />}
    </div>
  )
}
