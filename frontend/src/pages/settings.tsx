import { useState } from "react"
import { cn } from "cn"
import { SettingsTabGlobalControls } from "@/pages/settings-tab-global-controls"
import { SettingsTabIntegrations } from "@/pages/settings-tab-integrations"
import { SettingsTabReps } from "@/pages/settings-tab-reps"
import { SettingsTabSuppression } from "@/pages/settings-tab-suppression"

const TABS = [
  { key: "reps", label: "Reps", component: SettingsTabReps },
  { key: "suppression", label: "Suppression List", component: SettingsTabSuppression },
  { key: "integrations", label: "Integrations", component: SettingsTabIntegrations },
  { key: "global", label: "Global Controls", component: SettingsTabGlobalControls },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function Settings() {
  const [tab, setTab] = useState<TabKey>("reps")
  const ActiveTab = TABS.find((t) => t.key === tab)?.component ?? SettingsTabReps

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>

      <nav className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              tab === t.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <ActiveTab />
    </div>
  )
}
