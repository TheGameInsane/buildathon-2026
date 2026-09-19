import { delay } from "@/api/delay"
import { listIntegrations, testIntegrationConnection } from "@/mocks/integrations"
import type { IntegrationRecord } from "@/types/domain"

/** GET /integrations */
export async function fetchIntegrations(): Promise<IntegrationRecord[]> {
  await delay()
  return listIntegrations()
}

/** POST /integrations/:id/test */
export async function testIntegration(id: string): Promise<IntegrationRecord> {
  await delay(600)
  const result = testIntegrationConnection(id)
  if (!result) throw new Error(`Integration ${id} not found`)
  return result
}
