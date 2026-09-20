import { apiFetch } from "@/lib/api-client"

export interface AuthMember {
  name: string
  email: string
  role: string
}

export interface AuthResult {
  org_id: string
  api_key: string
  member: AuthMember
}

export interface RegisterPayload {
  companyName: string
  adminName: string
  email: string
  password: string
}

/** POST /auth/register — creates the workspace, its first admin and an API key. */
export async function registerTenant(payload: RegisterPayload): Promise<AuthResult> {
  return apiFetch<AuthResult>("/auth/register", {
    method: "POST",
    body: {
      company_name: payload.companyName,
      admin_name: payload.adminName,
      email: payload.email,
      password: payload.password,
    },
  })
}

export interface LoginPayload {
  email: string
  password: string
}

/** POST /auth/login — issues a fresh API key for this session. */
export async function loginTenant(payload: LoginPayload): Promise<AuthResult> {
  return apiFetch<AuthResult>("/auth/login", { method: "POST", body: payload })
}
