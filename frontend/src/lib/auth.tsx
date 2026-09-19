import { useEffect, useState, type ReactNode } from "react"
import { AuthContext, type AuthContextValue, type AuthUser } from "@/lib/auth-context"

/** Hardcoded seed users for the demo. No real auth infrastructure. */
const SEED_USERS: Record<string, { password: string; user: AuthUser }> = {
  "manager@demo.sdr": {
    password: "manager123",
    user: { email: "manager@demo.sdr", name: "Priya Sharma", role: "manager" },
  },
  "rep@demo.sdr": {
    password: "rep123",
    user: { email: "rep@demo.sdr", name: "Dev Patel", role: "rep" },
  },
}

const STORAGE_KEY = "auth-user"

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)

  useEffect(() => {
    if (user) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  }, [user])

  const login: AuthContextValue["login"] = (email, password) => {
    const match = SEED_USERS[email.trim().toLowerCase()]
    if (!match || match.password !== password) {
      return { ok: false, error: "Incorrect email or password." }
    }
    setUser(match.user)
    return { ok: true }
  }

  const logout = () => setUser(null)

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}
