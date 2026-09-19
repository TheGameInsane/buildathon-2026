import type { IntegrationRecord } from "@/types/domain"

const store: IntegrationRecord[] = [
  { id: "email", name: "Email", provider: "Gmail", status: "connected", lastCheckedAt: new Date(Date.now() - 3 * 60_000).toISOString() },
  { id: "whatsapp", name: "WhatsApp", provider: "Twilio", status: "connected", lastCheckedAt: new Date(Date.now() - 8 * 60_000).toISOString() },
  { id: "linkedin", name: "LinkedIn", provider: "Sales Navigator API", status: "connected", lastCheckedAt: new Date(Date.now() - 20 * 60_000).toISOString() },
  { id: "calendar", name: "Calendar", provider: "Google Calendar", status: "connected", lastCheckedAt: new Date(Date.now() - 60_000).toISOString() },
  { id: "mcp", name: "DronaHQ MCP", provider: "staging", status: "connected", lastCheckedAt: new Date(Date.now() - 90_000).toISOString() },
  { id: "apollo", name: "Apollo", provider: "Prospect enrichment", status: "disconnected", lastCheckedAt: new Date(Date.now() - 2 * 3_600_000).toISOString() },
]

export function listIntegrations(): IntegrationRecord[] {
  return store
}

export function testIntegrationConnection(id: string): IntegrationRecord | undefined {
  const integration = store.find((i) => i.id === id)
  if (!integration) return undefined
  integration.lastCheckedAt = new Date().toISOString()
  return integration
}
