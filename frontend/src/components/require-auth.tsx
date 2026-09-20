import { Navigate, useLocation } from "react-router-dom"
import { AppShell } from "@/components/shell/app-shell"
import { useAuth } from "@/hooks/use-auth"

/** Redirects to /login when no one is signed in, keeping the intended destination to return to. */
export function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <AppShell />
}
