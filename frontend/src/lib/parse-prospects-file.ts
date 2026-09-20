import { parseCsv } from "@/lib/csv"
import type { ImportedProspectRow } from "@/api/prospects"

/** Same idea as the backend's `normalise_prospect` (backend/api/dronahq_discovery.py):
 * dummy prospect files rarely use our exact field names, so a handful of common
 * aliases map onto them instead of forcing an exact header/key match. */
const FIELD_ALIASES: Record<keyof ImportedProspectRow, string[]> = {
  full_name: ["full_name", "name", "person_name", "contact_name"],
  email: ["email", "email_address", "work_email"],
  phone: ["phone", "phone_number", "mobile"],
  linkedin_url: ["linkedin_url", "linkedin", "linkedin_profile"],
  company: ["company", "company_name", "organization"],
  domain: ["domain", "company_domain", "website"],
  role: ["role", "title", "job_title", "position"],
  country: ["country", "location", "region"],
}

function normaliseRow(raw: Record<string, unknown>): ImportedProspectRow {
  const lower = new Map(Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase(), v]))
  const row: ImportedProspectRow = {}
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ImportedProspectRow, string[]][]) {
    for (const alias of aliases) {
      const value = lower.get(alias)
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        row[field] = String(value).trim()
        break
      }
    }
  }
  return row
}

export class ProspectsFileParseError extends Error {}

/** Parses a `.csv` or `.json` file into rows for `POST .../prospects/import`. JSON may
 * be a bare array of objects, or `{prospects: [...]}` / `{rows: [...]}`. Rows with no
 * recognised field at all are dropped client-side too, so the preview count the user
 * sees before uploading already matches what the server will actually import. */
export async function parseProspectsFile(file: File): Promise<ImportedProspectRow[]> {
  const text = await file.text()
  const isJson = file.name.toLowerCase().endsWith(".json")

  let records: Record<string, unknown>[]
  if (isJson) {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new ProspectsFileParseError("That file isn't valid JSON.")
    }
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as Record<string, unknown>)?.prospects ?? (parsed as Record<string, unknown>)?.rows)
    if (!Array.isArray(list)) {
      throw new ProspectsFileParseError("Expected a JSON array of prospects (or {\"prospects\": [...]})")
    }
    records = list.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
  } else {
    records = parseCsv(text)
  }

  const rows = records.map(normaliseRow).filter((row) => Object.keys(row).length > 0)
  if (!rows.length) {
    throw new ProspectsFileParseError("No usable prospect rows found in that file.")
  }
  return rows
}
