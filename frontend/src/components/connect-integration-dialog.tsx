import { useState } from "react"
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
import { Switch } from "@/components/ui/switch"
import { useUpsertIntegration } from "@/hooks/use-integrations"
import type { IntegrationRecord } from "@/types/domain"

interface ConfigField {
  key: string
  label: string
  placeholder?: string
  type?: "text" | "password"
}

/** Only the fields each provider's adapter actually reads (backend/channels/*.py).
 * A provider with no adapter yet (voice, calendar, search, enrichment) falls back to
 * a single free-form field — the backend only stores it encrypted, nothing reads it. */
const PROVIDER_FIELDS: Record<string, ConfigField[]> = {
  email_smtp_imap: [
    { key: "host", label: "SMTP host", placeholder: "smtp.gmail.com" },
    { key: "port", label: "Port", placeholder: "587" },
    { key: "username", label: "Username", placeholder: "you@gmail.com" },
    { key: "password", label: "Password", placeholder: "App password", type: "password" },
    { key: "from_address", label: "From address (optional)", placeholder: "you@gmail.com" },
  ],
  twilio_whatsapp: [
    { key: "account_sid", label: "Account SID" },
    { key: "auth_token", label: "Auth token", type: "password" },
    { key: "from_number", label: "From number", placeholder: "+1..." },
  ],
}

const DEFAULT_FIELDS: ConfigField[] = [{ key: "config", label: "Credentials (provider-specific)" }]

/** Settings > Integrations' Connect/Edit — the `useUpsertIntegration` mutation
 * (PUT /integrations/:provider) already existed; this is the dialog that calls it.
 * Gmail's SMTP needs an app password here, not the account password (myaccount.
 * google.com/apppasswords) — 2-Step Verification has to be on first. */
export function ConnectIntegrationDialog({ integration }: { integration: IntegrationRecord }) {
  const [open, setOpen] = useState(false)
  const fields = PROVIDER_FIELDS[integration.id] ?? DEFAULT_FIELDS
  const [config, setConfig] = useState<Record<string, string>>({})
  const [live, setLive] = useState(integration.mode === "live")
  const upsert = useUpsertIntegration()

  const reset = () => {
    setConfig({})
    setLive(integration.mode === "live")
    upsert.reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {integration.configured ? "Edit" : "Connect"}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {integration.configured ? "Edit" : "Connect"} {integration.name} ({integration.provider})
          </DialogTitle>
          <DialogDescription>
            Credentials are encrypted at rest and never shown again after saving.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`integration-${field.key}`}>{field.label}</Label>
              <Input
                id={`integration-${field.key}`}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                value={config[field.key] ?? ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                disabled={upsert.isPending}
              />
            </div>
          ))}

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Live mode</p>
              <p className="text-xs text-text-secondary">
                Off sends nothing to the real provider — actions are just logged (sandbox).
              </p>
            </div>
            <Switch checked={live} onCheckedChange={setLive} disabled={upsert.isPending} />
          </div>

          {upsert.isError && <p className="text-xs text-status-attention">{upsert.error.message}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={upsert.isPending}
            onClick={() =>
              upsert.mutate(
                { provider: integration.id, config, mode: live ? "live" : "sandbox" },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
