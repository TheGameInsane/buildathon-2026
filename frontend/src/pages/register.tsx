import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { z } from "zod"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/wizard/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"

const registerSchema = z
  .object({
    companyName: z.string().min(1, "Workspace name is required").max(200),
    adminName: z.string().min(1, "Your name is required").max(200),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type RegisterValues = z.infer<typeof registerSchema>

export function Register() {
  const { register: registerTenant } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { companyName: "", adminName: "", email: "", password: "", confirmPassword: "" },
  })

  async function onSubmit(values: RegisterValues) {
    setFormError(null)
    const result = await registerTenant({
      companyName: values.companyName,
      adminName: values.adminName,
      email: values.email,
      password: values.password,
    })
    if (result.ok) {
      navigate("/", { replace: true })
    } else {
      setFormError(result.error)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-[10px] border border-border bg-surface p-6">
        <div className="mx-auto">
          <Logo size="lg" />
        </div>

        <div>
          <h1 className="text-base font-semibold text-text-primary">
            Create your workspace
          </h1>
          <p className="mt-1 text-xs text-text-secondary">
            One workspace per company. You can invite reps and connect channels
            after.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field
            label="Company / workspace name"
            htmlFor="register-company"
            error={errors.companyName?.message}
          >
            <Input
              id="register-company"
              autoComplete="organization"
              placeholder="Acme Logistics"
              autoFocus
              {...register("companyName")}
            />
          </Field>

          <Field
            label="Your full name"
            htmlFor="register-name"
            error={errors.adminName?.message}
          >
            <Input
              id="register-name"
              autoComplete="name"
              placeholder="Priya Sharma"
              {...register("adminName")}
            />
          </Field>

          <Field
            label="Work email"
            htmlFor="register-email"
            error={errors.email?.message}
          >
            <Input
              id="register-email"
              type="email"
              autoComplete="username"
              placeholder="priya@acmelogistics.com"
              {...register("email")}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="register-password"
            error={errors.password?.message}
          >
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="register-confirm-password"
            error={errors.confirmPassword?.message}
          >
            <Input
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
          </Field>

          {formError && (
            <p className="text-sm text-status-attention">{formError}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating workspace…" : "Create workspace"}
          </Button>
        </form>

        <p className="border-t border-border pt-4 text-xs text-text-secondary">
          Already have a workspace?{" "}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
