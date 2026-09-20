import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import { campaignChartColors } from "@/lib/tokens"
import type { CampaignMetrics } from "@/types/domain"

export interface CompareMetricsChartProps {
  campaigns: { id: string; name: string }[]
  metrics: (CampaignMetrics | undefined)[]
  className?: string
}

interface Panel {
  key: "responseRate" | "meetingConversionRate" | "costPerQualifiedLead"
  title: string
  formatValue: (v: number) => string
}

const PANELS: Panel[] = [
  { key: "responseRate", title: "Response rate", formatValue: (v) => `${v.toFixed(0)}%` },
  { key: "meetingConversionRate", title: "Meeting rate", formatValue: (v) => `${v.toFixed(1)}%` },
  {
    key: "costPerQualifiedLead",
    title: "Cost per qualified lead",
    formatValue: (v) => `$${v.toFixed(2)}`,
  },
]

/** Response rate, meeting rate, and cost per qualified lead sit on very different
 * scales (percent vs. dollars), so — per the one-axis rule — this is three small
 * multiples sharing one campaign legend, not one chart with two y-axes. */
export function CompareMetricsChart({ campaigns, metrics, className }: CompareMetricsChartProps) {
  const rows = campaigns.map((c, i) => ({ campaign: c, metrics: metrics[i] }))

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PANELS.map((panel) => {
          const data = rows.map((r) => ({
            name: r.campaign.name,
            value: r.metrics ? r.metrics[panel.key] : 0,
          }))
          return (
            <div key={panel.key} className="rounded-[10px] border border-border bg-surface p-3">
              <p className="mb-2 text-xs font-semibold text-text-secondary">{panel.title}</p>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={false} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "var(--canvas)" }}
                      formatter={(value) => panel.formatValue(Number(value))}
                      contentStyle={{
                        background: "var(--surface-raised)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--text-secondary)" }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(v: unknown) => panel.formatValue(Number(v))}
                        style={{ fill: "var(--text-secondary)", fontSize: 11 }}
                      />
                      {data.map((_, i) => (
                        <Cell key={i} fill={campaignChartColors[i % campaignChartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })}
      </div>

      {/* One shared legend: the same campaign/colour mapping applies to all three panels above. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {campaigns.map((c, i) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: campaignChartColors[i % campaignChartColors.length] }}
            />
            {c.name}
          </span>
        ))}
      </div>
    </div>
  )
}
