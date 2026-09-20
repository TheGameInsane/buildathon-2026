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

/** Entire card opens Prompt Studio for this agent — the Pause/Resume button stops that click from bubbling. */
export function AgentCard({ agent, campaignId, onTogglePause, className }: AgentCardProps) {
  const AgentIcon = icons.agent

  return (
    <Link
      to={`/prompt-studio?campaignId=${campaignId}&agent=${encodeURIComponent(agent.name)}`}
      className={cn(
        "group/card flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4 transition-shadow",
        agent.status === "active" && "hover:border-brand-600/25 hover:shadow-[0_0_24px_-14px_rgba(46,125,255,0.6)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-text-primary group-hover/card:text-brand-600">
          <AgentIcon className="size-4 shrink-0" />
          <span className="truncate">{agent.name} Agent</span>
        </span>
        <StatusPill
          status={agent.status === "active" ? "live" : "paused"}
          pulse={agent.status === "active"}
          label={agent.status === "active" ? "Active" : "Paused"}
        />
      </div>

      <p className="text-xs text-text-secondary">
        Last run: {agent.lastRunAt ? timeAgo(agent.lastRunAt) : "never"} · v{agent.activeVersion}
        {agent.activeVersion === 0 ? " (default)" : " active"}
      </p>
      <p className="text-xs text-text-secondary">
        {agent.runsToday} runs today · {agent.succeeded} succeeded · {agent.failed} failed
      </p>
      <p className="text-xs text-text-secondary">
        Avg cost/run: ${agent.avgCost.toFixed(3)} · Avg latency: {(agent.avgLatencyMs / 1000).toFixed(1)}s
      </p>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onTogglePause?.(agent)
          }}
        >
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
    </Link>
  )
}
