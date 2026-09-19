import { listProspects } from "@/mocks/prospects"
import { suppressForBounce } from "@/mocks/suppression"
import type { MailboxHealth, Status } from "@/types/domain"

const store = new Map<string, MailboxHealth[]>()

function healthForBounceRate(bounceRate: number): Status {
  if (bounceRate >= 5) return "attention"
  if (bounceRate >= 2) return "paused"
  return "live"
}

/** Cheap deterministic pseudo-randomness so each campaign's mailboxes look distinct but stable across reloads. */
function seededInt(seed: string, max: number): number {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % max
}

function seedMailboxes(campaignId: string): MailboxHealth[] {
  const mailboxes: MailboxHealth[] = [
    {
      id: `${campaignId}-mb-1`,
      email: `outreach@${campaignId}.sarvam-demo.com`,
      sentToday: 30 + seededInt(`${campaignId}-1`, 20),
      bounceRate: seededInt(`${campaignId}-1b`, 2),
      health: "live",
      warmupProgressPct: null,
    },
    {
      id: `${campaignId}-mb-2`,
      email: `sdr2@${campaignId}.sarvam-demo.com`,
      sentToday: 10 + seededInt(`${campaignId}-2`, 15),
      bounceRate: 2 + seededInt(`${campaignId}-2b`, 5),
      health: "live",
      warmupProgressPct: null,
    },
    {
      id: `${campaignId}-mb-3`,
      email: `new-inbox@${campaignId}.sarvam-demo.com`,
      sentToday: seededInt(`${campaignId}-3`, 8),
      bounceRate: 0,
      health: "live",
      // Newly connected inbox: a stored counter that increments once per simulated day.
      warmupProgressPct: 10 + seededInt(`${campaignId}-3w`, 30),
    },
  ]
  for (const mailbox of mailboxes) mailbox.health = healthForBounceRate(mailbox.bounceRate)

  // One hard bounce on the least healthy mailbox auto-suppresses that prospect (policy: bounced check).
  const worst = mailboxes.reduce((a, b) => (a.bounceRate >= b.bounceRate ? a : b))
  if (worst.health === "attention") {
    const prospect = listProspects(campaignId)[0]
    if (prospect) {
      const domain = `${prospect.company.toLowerCase().replace(/\s+/g, "")}.com`
      const email = `${prospect.name.split(" ")[0].toLowerCase()}@${domain}`
      suppressForBounce(prospect.name, email)
    }
  }

  return mailboxes
}

function getStore(campaignId: string): MailboxHealth[] {
  if (!store.has(campaignId)) store.set(campaignId, seedMailboxes(campaignId))
  return store.get(campaignId)!
}

/**
 * Ticks a newly connected mailbox's warmup counter up a little on each read — just a
 * stored counter, no real warmup infrastructure, but it visibly climbs across the
 * Overview tab's poll interval for the demo.
 */
export function listMailboxHealth(campaignId: string): MailboxHealth[] {
  const mailboxes = getStore(campaignId)
  for (const mailbox of mailboxes) {
    if (mailbox.warmupProgressPct !== null) mailbox.warmupProgressPct = Math.min(100, mailbox.warmupProgressPct + 1)
  }
  return mailboxes
}
