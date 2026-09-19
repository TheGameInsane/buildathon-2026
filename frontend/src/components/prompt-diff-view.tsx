import { diffLines } from "diff"
import { cn } from "cn"
import { timeAgo } from "@/lib/format"
import type { PromptVersion } from "@/types/domain"

function evalScoreClassName(score: number) {
  if (score >= 85) return "bg-status-live/10 text-status-live"
  if (score >= 60) return "bg-status-paused/10 text-status-paused"
  return "bg-status-attention/10 text-status-attention"
}

function EvalScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", evalScoreClassName(score))}>
      eval {score}%
    </span>
  )
}

function VersionHeader({ version }: { version: PromptVersion }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
      <div>
        <p className="text-sm font-semibold text-text-primary">
          v{version.version}
          {version.active && <span className="ml-1.5 text-xs font-normal text-text-secondary">(active)</span>}
        </p>
        <p className="text-xs text-text-secondary">
          {version.author} · {timeAgo(version.timestamp)}
        </p>
      </div>
      <EvalScoreBadge score={version.evalScore} />
    </div>
  )
}

export interface PromptDiffViewProps {
  left: PromptVersion
  right: PromptVersion
  className?: string
}

/** Two-column side-by-side diff between two prompt versions. */
export function PromptDiffView({ left, right, className }: PromptDiffViewProps) {
  const parts = diffLines(left.content, right.content)

  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", className)}>
      <div className="flex flex-col gap-2">
        <VersionHeader version={left} />
        <pre className="whitespace-pre-wrap break-words font-mono text-[13px]">
          {parts
            .filter((part) => !part.added)
            .map((part, i) => (
              <span
                key={i}
                className={cn(
                  "block",
                  part.removed && "bg-status-attention/10 text-status-attention line-through decoration-status-attention/50",
                )}
              >
                {part.value}
              </span>
            ))}
        </pre>
      </div>
      <div className="flex flex-col gap-2">
        <VersionHeader version={right} />
        <pre className="whitespace-pre-wrap break-words font-mono text-[13px]">
          {parts
            .filter((part) => !part.removed)
            .map((part, i) => (
              <span key={i} className={cn("block", part.added && "bg-status-live/10 text-status-live")}>
                {part.value}
              </span>
            ))}
        </pre>
      </div>
    </div>
  )
}
