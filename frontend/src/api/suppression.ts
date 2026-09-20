/** Wired to the real backend (`backend/api/suppression.py`). */
import { apiFetch } from "@/lib/api-client"
import type { SuppressionEntry, SuppressionReason } from "@/types/domain"

interface BackendSuppressionEntry {
  id: string
  email: string | null
  phone: string | null
  linkedin_url: string | null
  reason: string | null
  created_at: string
}

const KNOWN_REASONS: SuppressionReason[] = ["unsubscribed", "bounced", "manual"]

function normalizeReason(reason: string | null): SuppressionReason {
  return KNOWN_REASONS.includes(reason as SuppressionReason) ? (reason as SuppressionReason) : "manual"
}

// The backend row has no join back to a prospect name — suppression is keyed on
// email/phone/linkedin_url only, so `prospectName` is left blank rather than invented.
function toSuppressionEntry(row: BackendSuppressionEntry): SuppressionEntry {
  return {
    id: row.id,
    prospectName: "",
    email: row.email ?? row.phone ?? row.linkedin_url ?? "",
    reason: normalizeReason(row.reason),
    addedAt: row.created_at,
  }
}

/** GET /suppression */
export async function fetchSuppressionEntries(): Promise<SuppressionEntry[]> {
  const rows = await apiFetch<BackendSuppressionEntry[]>("/suppression")
  return rows.map(toSuppressionEntry)
}

/** DELETE /suppression/:id: re-enables outreach to this prospect. */
export async function deleteSuppressionEntry(id: string): Promise<void> {
  await apiFetch(`/suppression/${id}`, { method: "DELETE" })
}
