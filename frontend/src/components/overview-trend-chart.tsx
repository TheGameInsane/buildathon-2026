import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import { channelChartColors } from "@/lib/tokens"
import type { DailyChannelTouches } from "@/types/domain"

export interface OverviewTrendChartProps {
  data: DailyChannelTouches[]
  className?: string
}

const SERIES: { key: "email" | "whatsapp" | "linkedin"; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "linkedin", label: "LinkedIn" },
]

/** Cross-campaign trend on the Overview page: stacked by channel, so volume and mix both show at a glance. */
export function OverviewTrendChart({ data, className }: OverviewTrendChartProps) {
  return (
    <div className={className} style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="day"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
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
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
            iconType="circle"
            iconSize={8}
          />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="touches" fill={channelChartColors[s.key]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
