/**
 * The one place that talks to the real backend over HTTP. Every other `api/*.ts`
 * module in this app still returns mocked data (see their own file comments) —
 * `auth.ts` is the first to call a real server, since registration and login need
 * actual persistence from the very first screen a new tenant sees.
 *
 * The backend's error shape is always `{code, message, details}` at the top level of
 * the response body (see backend/api/errors.py) — `ApiError` carries that through
 * instead of a generic HTTP status message, so forms can show the real reason.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

/** Session storage key for the signed-in tenant (see lib/auth.tsx) — lives here, not
 * in auth.tsx, so this module can read the stored API key without an import cycle. */
export const AUTH_STORAGE_KEY = "auth-user"

interface StoredAuth {
  apiKey: string
  actor: string
}

/** Every authenticated request needs the org-scoped API key and an actor name for
 * `X-Actor` — read once here instead of threading them through every api/*.ts call. */
function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { apiKey?: string; name?: string }
    return parsed.apiKey ? { apiKey: parsed.apiKey, actor: parsed.name ?? "" } : null
  } catch {
    return null
  }
}

export class ApiError extends Error {
  code: string
  details: Record<string, unknown>
  status: number

  constructor(status: number, code: string, message: string, details: Record<string, unknown>) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

interface ApiErrorBody {
  code?: string
  message?: string
  details?: Record<string, unknown>
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
  apiKey?: string
  actor?: string
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const stored = getStoredAuth()
  const apiKey = options.apiKey ?? stored?.apiKey
  const actor = options.actor ?? stored?.actor

  // FormData (file uploads) must NOT get a manual Content-Type: the browser sets
  // multipart/form-data with the right boundary itself, and must send the body as-is,
  // never JSON-stringified.
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" }
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`
  if (actor) headers["X-Actor"] = actor

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: isFormData
        ? (options.body as FormData)
        : options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server. Is the backend running?", {})
  }

  if (response.status === 204) return undefined as T

  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody & Record<string, unknown>

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.code ?? "error",
      payload.message ?? "Something went wrong. Please try again.",
      payload.details ?? {},
    )
  }

  return payload as T
}
