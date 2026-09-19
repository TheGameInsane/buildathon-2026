/**
 * Design System tokens (Notion: "Design System" page).
 * CSS-side mirror lives in src/index.css (:root custom properties + @theme).
 * Keep these two in sync: nothing on any screen should use a colour, font
 * size, spacing value, or icon that isn't listed here.
 */
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  Coins,
  FileEdit,
  GitBranch,
  GitMerge,
  Mail,
  MessageCircle,
  Pause,
  Power,
  ShieldAlert,
  ShieldCheck,
  Bot,
  User,
  type LucideIcon,
} from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import { LinkedinIcon } from "@/components/icons/linkedin"

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

export type Status = "live" | "paused" | "draft" | "completed" | "attention"
/** Email, WhatsApp, LinkedIn only. Voice is not a supported channel. */
export type Channel = "email" | "whatsapp" | "linkedin"

export const colors = {
  brand600: "#2E7DFF",
  brand50: "#142248",
  accentCyan: "#22D3EE",
  accentLime: "#A3E635",
  statusLive: "#22C55E",
  statusPaused: "#F59E0B",
  statusDraft: "#6B7A99",
  statusCompleted: "#6366F1",
  statusAttention: "#EF4444",
  surface: "#10162A",
  surfaceRaised: "#161D35",
  canvas: "#0A0E1A",
  border: "#232B45",
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
} as const

/** The 5 status colours are the entire vocabulary of the product: never a 6th. */
export const statusMeta: Record<
  Status,
  { color: string; icon: LucideIcon; pulse: boolean; label: string }
> = {
  live: { color: colors.statusLive, icon: Circle, pulse: true, label: "Live" },
  paused: { color: colors.statusPaused, icon: Pause, pulse: false, label: "Paused" },
  draft: { color: colors.statusDraft, icon: FileEdit, pulse: false, label: "Draft" },
  completed: { color: colors.statusCompleted, icon: CheckCircle2, pulse: false, label: "Completed" },
  attention: { color: colors.statusAttention, icon: AlertTriangle, pulse: false, label: "Needs attention" },
}

/** Fixed icon-to-meaning mapping: do not swap these once chosen. */
export const channelIcons: Record<Channel, IconComponent> = {
  email: Mail,
  whatsapp: MessageCircle,
  linkedin: LinkedinIcon,
}

/**
 * Categorical chart colour per channel (channel-mix donut/bar only, never used
 * for status). Fixed order per the dataviz skill's validated palette.
 */
export const channelChartColors: Record<Channel, string> = {
  email: "#2A78D6",
  whatsapp: "#EB6834",
  linkedin: "#EDA100",
}

export const icons = {
  grounded: ShieldCheck,
  killSwitch: Power,
  agent: Bot,
  prospect: User,
  meeting: Calendar,
  cost: Coins,
  promptVersion: GitBranch,
  conflict: GitMerge,
  approval: ShieldAlert,
} as const

/** Page title / section heading / card title / body / caption / metric / mono. */
export const typography = {
  pageTitle: "text-2xl font-semibold",
  sectionHeading: "text-lg font-semibold",
  cardTitle: "text-[15px] font-semibold",
  body: "text-sm",
  caption: "text-xs text-text-secondary",
  metric: "text-3xl font-bold tabular-nums",
  mono: "font-mono text-[13px]",
} as const

/** Base unit 4px: only use multiples of 4. */
export const spacing = {
  base: 4,
  scale: [4, 8, 12, 16, 24, 32, 48] as const,
  pagePaddingDesktop: 24,
  pagePaddingMobile: 16,
  cardPaddingCompact: 16,
  cardPaddingFeature: 20,
  cardGap: 16,
  maxContentWidth: 1280,
} as const

/** Card radius 10px, button/input radius 8px, pill radius full. */
export const radius = {
  card: 10,
  control: 8,
  pill: 9999,
} as const

export const motion = {
  liveDotPulseMs: 1600,
  activityFeedItemMs: 200,
  counterMs: 400,
  pageTransitionMs: 150,
  toastAutoDismissMs: 4000,
} as const

/** Overview, Campaign Overview, and the Activity Feed poll on this interval. */
export const pollIntervalMs = 5000

/** The Overview page's touches-by-channel trend chart is a trend view, not a live counter: ~90 min, not 5s. */
export const overviewTrendPollIntervalMs = 90 * 60 * 1000
