import { useEffect, useState } from "react"

export type Theme = "dark" | "light"

const STORAGE_KEY = "theme"

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === "light" ? "light" : "dark"
}

/** Persists to localStorage and toggles the `data-theme` attribute the CSS tokens key off. Defaults to dark. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return {
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  }
}
