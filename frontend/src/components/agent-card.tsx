import { Link } from "react-router-dom"
import { Pause, Play } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/status-pill"
import { icons } from "@/lib/tokens"
import { timeAgo } from "@/lib/format"
import type { Agent } from "@/types/domain"

export interface AgentCardProps {
  agent: Agent
  campaignId: string
  onTogglePause?: (agent: Agent) => void
  className?: string
}

export function AgentCard({ agent, campaignId, onTogglePause, className }: AgentCardProps) {
  const AgentIcon = icons.agent

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4 transition-shadow",
        agent.status === "active" && "hover:border-brand-600/25 hover:shadow-[0_0_24px_-14px_rgba(46,125,255,0.6)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/prompt-studio?campaignId=${campaignId}&agent=${encodeURIComponent(agent.name)}`}
          className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-text-primary hover:text-brand-600"
        >
          <AgentIcon className="size-4 shrink-0" />
          <span className="truncate">{agent.name} Agent</span>
        </Link>
        <StatusPill
          status={agent.status === "active" ? "live" : "paused"}
          pulse={agent.status === "active"}
          label={agent.status === "active" ? "Active" : "Paused"}
        />
      </div>

      <p className="text-xs text-text-secondary">
        Last run: {timeAgo(agent.lastRunAt)} · v{agent.activeVersion} active
      </p>
      <p className="text-xs text-text-secondary">
        {agent.runsToday} runs today · {agent.succeeded} succeeded · {agent.failed} failed
      </p>
      <p className="text-xs text-text-secondary">
        Avg cost/run: ${agent.avgCost.toFixed(3)} · Avg latency: {(agent.avgLatencyMs / 1000).toFixed(1)}s
      </p>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => onTogglePause?.(agent)}>
          {agent.status === "active" ? (
            <>
              <Pause /> Pause agent
            </>
          ) : (
            <>
              <Play /> Resume agent
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
