import type { SuppressionEntry } from "@/types/domain"

let store: SuppressionEntry[] = [
  {
    id: "sup-1",
    prospectName: "Marcus Webb",
    email: "marcus.webb@ironclad.io",
    reason: "unsubscribed",
    addedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
  },
  {
    id: "sup-2",
    prospectName: "Grace Liu",
    email: "grace.liu@northbeam.co",
    reason: "bounced",
    addedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    id: "sup-3",
    prospectName: "Diego Alvarez",
    email: "diego@fieldstone.com",
    reason: "manual",
    addedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
]

export function listSuppressionEntries(): SuppressionEntry[] {
  return store
}

export function removeFromSuppression(id: string): void {
  store = store.filter((e) => e.id !== id)
}

/** Auto-suppress after exactly one hard bounce (no-op if this email is already suppressed). */
export function suppressForBounce(prospectName: string, email: string): void {
  if (store.some((e) => e.email === email)) return
  store = [
    ...store,
    { id: `sup-bounce-${email}`, prospectName, email, reason: "bounced", addedAt: new Date().toISOString() },
  ]
}
