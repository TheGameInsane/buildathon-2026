import { apiFetch } from "@/lib/api-client"
import type { IntegrationMode, IntegrationRecord } from "@/types/domain"

/**
 * Wired to `GET /integrations`, `PUT /integrations/:provider` and
 * `POST /integrations/:provider/test` (backend/api/integrations.py). The backend key
 * is the provider slug (e.g. `email_smtp_imap`), not a display name —
 * `PROVIDER_LABELS` gives it a readable `name`/`provider` pair for the UI.
 *
 * `GET /integrations` only returns rows that have ever been `PUT` — a fresh org has
 * none — so `KNOWN_PROVIDERS` (the same 7 the backend accepts) lets Settings show every
 * provider as an option, connected or not, instead of an empty list with no way to add
 * one. `channels_connected` (the preflight check) is satisfied once any one of these is
 * saved with `mode: "live"` — the backend doesn't require a passing Test first.
 */

export const PROVIDER_LABELS: Record<string, { name: string; provider: string }> = {
  email_smtp_imap: { name: "Email", provider: "SMTP / IMAP" },
  gmail_oauth: { name: "Email", provider: "Gmail" },
  twilio_whatsapp: { name: "WhatsApp", provider: "Twilio" },
  dronahq_voice: { name: "Voice", provider: "DronaHQ" },
  google_calendar: { name: "Calendar", provider: "Google Calendar" },
  web_search: { name: "Web search", provider: "Web search" },
  enrichment: { name: "Enrichment", provider: "Enrichment" },
}

export const KNOWN_PROVIDERS = Object.keys(PROVIDER_LABELS)

interface BackendIntegrationStatus {
  provider: string
  mode: IntegrationMode
  connected: boolean
  detail: string
  last_checked_at: string | null
}

function toRecord(row: BackendIntegrationStatus): IntegrationRecord {
  const label = PROVIDER_LABELS[row.provider] ?? { name: row.provider, provider: row.provider }
  return {
    id: row.provider,
    name: label.name,
    provider: label.provider,
    status: row.connected ? "connected" : "disconnected",
    mode: row.mode,
    configured: true,
    lastCheckedAt: row.last_checked_at,
  }
}

/** GET /integrations, filled out with a "not configured" placeholder for every known
 * provider that has no row yet, so the page always lists all 7. */
export async function fetchIntegrations(): Promise<IntegrationRecord[]> {
  const rows = await apiFetch<BackendIntegrationStatus[]>("/integrations")
  const byProvider = new Map(rows.map((r) => [r.provider, toRecord(r)]))
  return KNOWN_PROVIDERS.map((provider) => {
    const label = PROVIDER_LABELS[provider]
    return (
      byProvider.get(provider) ?? {
        id: provider,
        name: label.name,
        provider: label.provider,
        status: "disconnected",
        mode: "sandbox",
        configured: false,
        lastCheckedAt: null,
      }
    )
  })
}

/** PUT /integrations/:provider — connects a new one or replaces an existing one's
 * credentials/mode entirely (the backend re-encrypts and overwrites, never merges). */
export async function upsertIntegration(
  provider: string,
  config: Record<string, string>,
  mode: IntegrationMode,
): Promise<IntegrationRecord> {
  const row = await apiFetch<BackendIntegrationStatus>(`/integrations/${provider}`, {
    method: "PUT",
    body: { config, mode },
  })
  return toRecord(row)
}

/** POST /integrations/:provider/test — the test endpoint only returns {connected, detail}, so refetch the full row after. */
export async function testIntegration(id: string): Promise<IntegrationRecord> {
  await apiFetch<{ connected: boolean; detail: string }>(`/integrations/${id}/test`, { method: "POST" })
  const rows = await apiFetch<BackendIntegrationStatus[]>("/integrations")
  const row = rows.find((r) => r.provider === id)
  if (!row) throw new Error(`Integration ${id} not found`)
  return toRecord(row)
}
