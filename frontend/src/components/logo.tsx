import { cn } from "cn"
import { useTheme } from "@/hooks/use-theme"

export interface LogoProps {
  /** "sm" for the top bar; "lg" for the login/register cards. */
  size?: "sm" | "lg"
  className?: string
}

const SIZE = { sm: "h-7", lg: "h-9" } as const

/** The Nuncia mark + wordmark, combined in one image — no box, background, or
 * shadow around it, just the logo at a fixed height with its natural aspect ratio. */
export function Logo({ size = "sm", className }: LogoProps) {
  const { theme } = useTheme()
  const src = theme === "dark" ? "/combined_logo_dark_mode.png" : "/combined_logo_light_mode.png"

  return <img src={src} alt="Nuncia" className={cn(SIZE[size], "w-auto", className)} />
}
