import { createContext } from "react"

export type UserRole = "manager" | "rep"

export interface AuthUser {
  email: string
  name: string
  role: UserRole
}

export interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string }
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
