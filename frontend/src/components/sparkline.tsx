import { Line, LineChart, ResponsiveContainer } from "recharts"
import { colors } from "@/lib/tokens"

export interface SparklineProps {
  data: number[]
  className?: string
}

export function Sparkline({ data, className }: SparklineProps) {
  const points = data.map((v, i) => ({ i, v }))
  return (
    <div className={className} style={{ width: 64, height: 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={colors.brand600}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
