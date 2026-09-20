import { Loader2 } from "lucide-react"
import { cn } from "cn"
import { ConnectIntegrationDialog } from "@/components/connect-integration-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useIntegrations, useTestIntegration } from "@/hooks/use-integrations"
import { timeAgo } from "@/lib/format"

export function SettingsTabIntegrations() {
  const { data: integrations, isLoading } = useIntegrations()
  const testConnection = useTestIntegration()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-[10px] border border-border bg-surface">
      {integrations?.map((integration) => {
        const testingThis = testConnection.isPending && testConnection.variables === integration.id
        return (
          <div key={integration.id} className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  integration.status === "connected" ? "bg-status-live" : "bg-status-attention",
                )}
              />
              <div>
                <p className="text-sm font-medium text-text-primary">{integration.name}</p>
                <p className="text-xs text-text-secondary">
                  {integration.provider} · {integration.mode}
                  {" · "}
                  {integration.lastCheckedAt ? `Last checked ${timeAgo(integration.lastCheckedAt)}` : "Not checked yet"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ConnectIntegrationDialog integration={integration} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testingThis || !integration.configured}
                onClick={() => testConnection.mutate(integration.id)}
              >
                {testingThis && <Loader2 className="animate-spin" />}
                Test connection
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
