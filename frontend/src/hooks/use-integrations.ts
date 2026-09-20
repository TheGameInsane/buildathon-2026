import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { fetchIntegrations, testIntegration, upsertIntegration } from "@/api/integrations"
import type { IntegrationMode } from "@/types/domain"

const integrationsQueryKey = ["integrations"] as const

export function useIntegrations() {
  return useQuery({ queryKey: integrationsQueryKey, queryFn: fetchIntegrations })
}

export function useTestIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: testIntegration,
    onSuccess: (integration) => {
      toast.success(
        integration.status === "connected"
          ? `${integration.name} is connected.`
          : `${integration.name} could not be reached.`,
      )
      queryClient.invalidateQueries({ queryKey: integrationsQueryKey })
    },
  })
}

/** The Connect/Edit dialog's Save. */
export function useUpsertIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      provider,
      config,
      mode,
    }: {
      provider: string
      config: Record<string, string>
      mode: IntegrationMode
    }) => upsertIntegration(provider, config, mode),
    onSuccess: (integration) => {
      toast.success(`${integration.name} saved.`)
      queryClient.invalidateQueries({ queryKey: integrationsQueryKey })
    },
  })
}
