import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/"

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = login(email, password)
    if (result.ok) {
      navigate(redirectTo, { replace: true })
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-[10px] border border-border bg-surface p-6">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-cyan">
            <Sparkles className="size-4 text-white" />
          </span>
          Autonomous SDR
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@demo.sdr"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-status-attention">{error}</p>}

          <Button type="submit" className="w-full">
            Log in
          </Button>
        </form>

        <div className="space-y-1 border-t border-border pt-4 text-xs text-text-secondary">
          <p>Demo accounts:</p>
          <p>Manager: manager@demo.sdr, manager123</p>
          <p>Rep: rep@demo.sdr, rep123</p>
        </div>
      </div>
    </div>
  )
}
