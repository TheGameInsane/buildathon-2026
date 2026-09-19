import { useState } from "react"
import { Power } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const CONFIRM_WORD = "STOP"

export interface KillSwitchButtonProps {
  active: boolean
  onActivate: () => void
  className?: string
}

/** Always visible in the top bar. Requires typing "STOP" before it can be confirmed. */
export function KillSwitchButton({ active, onActivate, className }: KillSwitchButtonProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          active
            ? "bg-status-attention text-white hover:bg-status-attention/90"
            : "border border-status-attention bg-transparent text-status-attention hover:bg-status-attention/10",
          className,
        )}
      >
        <Power /> Kill Switch
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setTyped("")
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Kill switch</DialogTitle>
            <DialogDescription className="text-base text-text-primary">
              This stops every autonomous action across every campaign, immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="kill-switch-confirm">
              Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to confirm
            </Label>
            <Input
              id="kill-switch-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={typed !== CONFIRM_WORD}
              className="bg-status-attention text-white hover:bg-status-attention/90"
              onClick={() => {
                onActivate()
                setOpen(false)
                setTyped("")
              }}
            >
              Activate kill switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export interface KillSwitchBannerProps {
  onDeactivate: () => void
  activatedBy: string
  activatedAt: string
}

/** Thin red banner shown under the top bar once the kill switch is active. */
export function KillSwitchBanner({ onDeactivate, activatedBy, activatedAt }: KillSwitchBannerProps) {
  return (
    <div className="flex items-center justify-center gap-2 bg-status-attention px-4 py-1.5 text-xs font-medium text-white">
      Kill switch active. All campaigns halted. Activated by {activatedBy}, {activatedAt}.
      <button type="button" onClick={onDeactivate} className="underline underline-offset-2">
        Deactivate
      </button>
    </div>
  )
}
