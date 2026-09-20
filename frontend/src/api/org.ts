import { apiFetch } from "@/lib/api-client"

/**
 * Wired to `GET`/`PUT /org/company-profile` (backend/api/org.py). One row per org —
 * prompts are rendered from this for every campaign (spec section 5's onboarding step
 * 2), so it's the `company_profile_set` preflight check's only source of truth.
 */
export interface CompanyProfile {
  companyName: string
  website: string
  oneLiner: string
  description: string
  valueProps: string[]
  defaultTone: string
  brandVoice: string
  languages: string[]
  senderFooter: string
  unsubscribeText: string
  disclaimer: string
}

interface BackendCompanyProfile {
  company_name: string
  website: string | null
  one_liner: string | null
  description: string | null
  products: unknown[]
  value_props: string[]
  default_tone: string | null
  brand_voice: string | null
  languages: string[]
  sender_footer: string | null
  unsubscribe_text: string | null
  disclaimer: string | null
}

function toProfile(row: BackendCompanyProfile): CompanyProfile {
  return {
    companyName: row.company_name,
    website: row.website ?? "",
    oneLiner: row.one_liner ?? "",
    description: row.description ?? "",
    valueProps: row.value_props ?? [],
    defaultTone: row.default_tone ?? "",
    brandVoice: row.brand_voice ?? "",
    languages: row.languages ?? [],
    senderFooter: row.sender_footer ?? "",
    unsubscribeText: row.unsubscribe_text ?? "",
    disclaimer: row.disclaimer ?? "",
  }
}

/** GET /org/company-profile — null until the org's first save. */
export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
  const row = await apiFetch<BackendCompanyProfile | null>("/org/company-profile")
  return row ? toProfile(row) : null
}

/** PUT /org/company-profile — replaces the whole profile (the backend upserts, never merges). */
export async function saveCompanyProfile(profile: CompanyProfile): Promise<CompanyProfile> {
  const row = await apiFetch<BackendCompanyProfile>("/org/company-profile", {
    method: "PUT",
    body: {
      company_name: profile.companyName,
      website: profile.website || null,
      one_liner: profile.oneLiner || null,
      description: profile.description || null,
      products: [],
      value_props: profile.valueProps,
      default_tone: profile.defaultTone || null,
      brand_voice: profile.brandVoice || null,
      languages: profile.languages,
      sender_footer: profile.senderFooter || null,
      unsubscribe_text: profile.unsubscribeText || null,
      disclaimer: profile.disclaimer || null,
    },
  })
  return toProfile(row)
}
