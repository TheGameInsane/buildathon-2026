import { createContext } from "react"

/** Backend roles (org_members.role): admin, manager, rep, viewer (spec section 5). */
export type UserRole = "admin" | "manager" | "rep" | "viewer"

export interface AuthUser {
  orgId: string
  apiKey: string
  email: string
  name: string
  role: UserRole
}

export type AuthResult = { ok: true } | { ok: false; error: string }

export interface AuthContextValue {
  user: AuthUser | null
  /** Pending during the network round-trip so screens can show a loading state. */
  pending: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  register: (input: {
    companyName: string
    adminName: string
    email: string
    password: string
  }) => Promise<AuthResult>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
