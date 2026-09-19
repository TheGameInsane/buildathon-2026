import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { fetchIntegrations, testIntegration } from "@/api/integrations"

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
