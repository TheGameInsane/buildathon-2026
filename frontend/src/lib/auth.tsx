import { useEffect, useState, type ReactNode } from "react"
import { loginTenant, registerTenant, type AuthResult as ApiAuthResult } from "@/api/auth"
import { AUTH_STORAGE_KEY as STORAGE_KEY, ApiError } from "@/lib/api-client"
import { AuthContext, type AuthContextValue, type AuthResult, type AuthUser } from "@/lib/auth-context"

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function toAuthUser(result: ApiAuthResult): AuthUser {
  return {
    orgId: result.org_id,
    apiKey: result.api_key,
    email: result.member.email,
    name: result.member.name,
    role: result.member.role as AuthUser["role"],
  }
}

/** A network failure gets a generic message; a real API error (wrong password, taken
 * email, ...) shows the backend's own reason. */
function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return "Could not reach the server. Please try again."
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (user) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  }, [user])

  const login: AuthContextValue["login"] = async (email, password) => {
    setPending(true)
    try {
      const result = await loginTenant({ email, password })
      setUser(toAuthUser(result))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: errorMessage(err) }
    } finally {
      setPending(false)
    }
  }

  const register: AuthContextValue["register"] = async (input) => {
    setPending(true)
    try {
      const result = await registerTenant(input)
      setUser(toAuthUser(result))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: errorMessage(err) }
    } finally {
      setPending(false)
    }
  }

  const logout = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, pending, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export type { AuthResult }
