import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { channelChartColors } from "@/lib/tokens"
import type { Campaign, CampaignMetrics, Channel } from "@/types/domain"

export interface CompareChannelChartProps {
  campaigns: Campaign[]
  metrics: (CampaignMetrics | undefined)[]
  className?: string
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
]

/** Touches sent by channel, side by side per campaign — same channel colours as the
 * Overview trend chart and every channel-mix breakdown elsewhere in the product. */
export function CompareChannelChart({ campaigns, metrics, className }: CompareChannelChartProps) {
  const data = campaigns.map((c, i) => {
    const mix = metrics[i]?.channelMix ?? {}
    const row: Record<string, string | number> = { name: c.name }
    for (const { key } of CHANNELS) {
      // channelMix is a percentage of the campaign's cumulative touch count — there's
      // no separate cumulative-by-channel field, so this derives real counts from the
      // two real numbers the product already tracks, rather than inventing new data.
      row[key] = Math.round(((mix[key] ?? 0) / 100) * c.touchCount)
    }
    return row
  })

  return (
    <div className={className} style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            cursor={{ fill: "var(--canvas)" }}
            contentStyle={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text-secondary)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} iconType="circle" iconSize={8} />
          {CHANNELS.map((c) => (
            <Bar key={c.key} dataKey={c.key} name={c.label} fill={channelChartColors[c.key]} radius={[4, 4, 0, 0]} maxBarSize={40} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
