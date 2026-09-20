import { useMemo, useState } from "react"
import { CompareChannelChart } from "@/components/compare-channel-chart"
import { CompareMetricsChart } from "@/components/compare-metrics-chart"
import { MultiCombobox } from "@/components/ui/multi-combobox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaigns } from "@/hooks/use-campaigns"
import { useCompareMetrics } from "@/hooks/use-compare-metrics"

export function Compare() {
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns()
  const [selectedNames, setSelectedNames] = useState<string[] | null>(null)

  const selected = useMemo(() => {
    if (!campaigns) return []
    // Defaults to the first few campaigns so the screen isn't empty on first visit.
    const names = selectedNames ?? campaigns.slice(0, 3).map((c) => c.name)
    return campaigns.filter((c) => names.includes(c.name))
  }, [campaigns, selectedNames])

  const { data: metrics, isLoading: metricsLoading } = useCompareMetrics(selected.map((c) => c.id))

  if (campaignsLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">Compare</h1>
        <div className="flex w-full flex-col gap-1.5 sm:w-80">
          <Label htmlFor="compare-campaigns">Campaigns</Label>
          <MultiCombobox
            id="compare-campaigns"
            value={selected.map((c) => c.name)}
            onChange={(names) => setSelectedNames(names)}
            options={(campaigns ?? []).map((c) => c.name)}
            allowCustom={false}
            placeholder="Add a campaign…"
          />
        </div>
      </div>

      {selected.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center">
          <p className="text-sm text-text-secondary">Add at least one campaign to compare.</p>
        </div>
      ) : metricsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="rounded-[10px] border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-semibold text-text-primary">Metrics</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-text-secondary">
                    <th className="py-2 pr-4 font-medium">Campaign</th>
                    <th className="px-3 py-2 font-medium">Meetings</th>
                    <th className="px-3 py-2 font-medium">Response rate</th>
                    <th className="px-3 py-2 font-medium">Meeting rate</th>
                    <th className="px-3 py-2 font-medium">Cost per qualified lead</th>
                    <th className="px-3 py-2 font-medium">Touches sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selected.map((c, i) => {
                    const m = metrics[i]
                    return (
                      <tr key={c.id}>
                        <td className="py-2 pr-4 font-medium text-text-primary">{c.name}</td>
                        <td className="px-3 py-2 text-text-primary">{m?.meetings ?? "—"}</td>
                        <td className="px-3 py-2 text-text-primary">{m ? `${m.responseRate}%` : "—"}</td>
                        <td className="px-3 py-2 text-text-primary">
                          {m ? `${m.meetingConversionRate.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-text-primary">
                          {m ? `$${m.costPerQualifiedLead.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-text-primary">{c.touchCount.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[10px] border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-semibold text-text-primary">Response rate, meeting rate, and cost per qualified lead</p>
            <CompareMetricsChart campaigns={selected} metrics={metrics} />
          </div>

          <div className="rounded-[10px] border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-semibold text-text-primary">Touches sent by channel</p>
            <CompareChannelChart campaigns={selected} metrics={metrics} />
          </div>
        </>
      )}
    </div>
  )
}
