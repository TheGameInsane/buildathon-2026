import { z } from "zod"
import type { AgentName, Channel } from "@/types/domain"

const CHANNELS: Channel[] = ["email", "whatsapp", "linkedin"]

export const TONE_OPTIONS = [
  "Professional",
  "Friendly",
  "Concise",
  "Consultative",
  "Direct",
  "Casual",
  "Persuasive",
] as const
export type Tone = (typeof TONE_OPTIONS)[number]

const sequenceStepSchema = z.object({
  id: z.string(),
  channel: z.enum(CHANNELS as [Channel, ...Channel[]]),
  /** Days to wait after the previous step before sending this one (0 for the first step). */
  waitDays: z.number().min(0).max(30),
})
export type SequenceStep = z.infer<typeof sequenceStepSchema>

export const wizardSchema = z.object({
  // Step 1: Campaign
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  owner: z.string().min(1, "Owner is required"),

  // Step 2: Audience
  industry: z.string().min(1, "Industry is required"),
  geography: z.string().min(1, "Location is required"),
  targetRoles: z.array(z.string().min(1)).min(1, "Add at least one job title"),
  companySizeRange: z.string().min(1, "Company size is required"),
  exclusionCriteria: z.array(z.string().min(1)),
  sampleCompanies: z.array(z.string().min(1)).max(3, "Up to 3 sample companies"),

  // Step 3: Outreach
  channels: z.array(z.enum(CHANNELS as [Channel, ...Channel[]])).min(1, "Enable at least one channel"),
  dailyCaps: z.record(z.string(), z.number().min(1)),
  workingHours: z.string().min(1, "Working hours are required"),
  timezone: z.string().min(1, "Timezone is required"),
  requiresApprovalOnFirstTouch: z.boolean(),
  escalateOnPricingOrLegal: z.boolean(),

  // Step 4: Tone
  tones: z.array(z.enum(TONE_OPTIONS)).min(1, "Select at least one tone"),

  // Step 5: Sequence
  sequenceSteps: z.array(sequenceStepSchema).min(1, "Add at least one outreach step"),

  // Folded into Review: agents get default prompts silently (editable later in Prompt Studio)
  agentPrompts: z.record(z.string(), z.string().min(1, "Prompt can't be empty")),
  repIds: z.array(z.string()).min(1, "Assign at least one rep"),
})

export type WizardValues = z.infer<typeof wizardSchema>

export const STEP_FIELDS: (keyof WizardValues)[][] = [
  ["name", "description", "owner"],
  ["industry", "geography", "targetRoles", "companySizeRange", "exclusionCriteria", "sampleCompanies"],
  ["channels", "dailyCaps", "workingHours", "timezone", "requiresApprovalOnFirstTouch", "escalateOnPricingOrLegal"],
  ["tones"],
  ["sequenceSteps"],
  ["repIds"],
]

export const WIZARD_STEPS = ["Campaign", "Audience", "Outreach", "Tone", "Sequence", "Review", "Launch"] as const

export function wizardDefaultValues(owner: string, agentPrompts: Record<AgentName, string>): WizardValues {
  return {
    name: "",
    description: "",
    owner,
    industry: "",
    geography: "",
    targetRoles: [],
    companySizeRange: "",
    exclusionCriteria: [],
    sampleCompanies: [],
    channels: [],
    dailyCaps: {},
    workingHours: "9am–6pm",
    timezone: "America/New_York",
    requiresApprovalOnFirstTouch: true,
    escalateOnPricingOrLegal: true,
    tones: [],
    sequenceSteps: [{ id: crypto.randomUUID(), channel: "email", waitDays: 0 }],
    agentPrompts,
    repIds: [],
  }
}
