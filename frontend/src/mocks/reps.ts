import { listCampaigns } from "@/mocks/campaigns"
import { getCampaignSettings, updateCampaignSettings } from "@/mocks/campaign-settings"
import type { RepAssignment, RepRef } from "@/types/domain"

/** Global reps roster: Settings > Reps (global) and the New Campaign Wizard both read this. */
const store: RepRef[] = [
  { id: "rep-1", name: "Priya Sharma", email: "priya@company.com", dailyCap: 60, workingHours: "9am–6pm", active: true },
  { id: "rep-2", name: "Dev Patel", email: "dev@company.com", dailyCap: 50, workingHours: "9am–6pm", active: true },
  { id: "rep-3", name: "Ananya Iyer", email: "ananya@company.com", dailyCap: 40, workingHours: "10am–7pm", active: true },
]

export function listReps(): RepRef[] {
  return store
}

export function getRep(id: string): RepRef | undefined {
  return store.find((r) => r.id === id)
}

export function addRep(name: string): RepRef {
  const rep: RepRef = {
    id: `rep-${Date.now()}`,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
    dailyCap: 40,
    workingHours: "9am–6pm",
    active: true,
  }
  store.push(rep)
  return rep
}

export function setRepActive(id: string, active: boolean): void {
  const rep = store.find((r) => r.id === id)
  if (rep) rep.active = active
}

/** Which campaigns currently have this rep assigned, so offboarding can show what's affected. */
export function listAssignmentsForRep(repId: string): RepAssignment[] {
  return listCampaigns()
    .filter((c) => getCampaignSettings(c.id).reps.some((r) => r.id === repId))
    .map((c) => ({ campaignId: c.id, campaignName: c.name }))
}

/** Removes the rep from a campaign, optionally assigning a replacement. */
export function reassignCampaignRep(campaignId: string, oldRepId: string, newRepId: string | null): void {
  const settings = getCampaignSettings(campaignId)
  const withoutOld = settings.reps.filter((r) => r.id !== oldRepId)
  const replacement = newRepId ? getRep(newRepId) : undefined
  updateCampaignSettings(campaignId, {
    reps: replacement ? [...withoutOld, replacement] : withoutOld,
  })
}
