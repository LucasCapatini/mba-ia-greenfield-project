"use client"

import * as React from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { FieldError } from "@/components/auth/field-error"
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter"
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ApiErrorEnvelope } from "@/lib/api/contracts"
import { mapResetPasswordErrorToForm } from "@/lib/auth/error-mapping"
import { cn } from "@/lib/utils"

// Client-side validation mirror of ResetPasswordDto.new_password (8..128) plus
// the same strength rules the signup form applies (per saneamento-fase-02-e-infra/TD-04).
const resetPasswordSchema = z
  .object({
    new_password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(128, "Máximo 128 caracteres")
      .regex(/[a-zA-Z]/, "Inclua ao menos uma letra")
      .regex(/[0-9]/, "Inclua ao menos um número"),
    confirm_password: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "As senhas não coincidem",
    path: ["confirm_password"],
  })

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

type ResetPasswordFormProps = React.ComponentProps<"form"> & {
  /** Raw token from the e-mail link — owned by the RSC page, consumed on submit. */
  token: string
}

function ResetPasswordForm({ token, className, ...props }: ResetPasswordFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: "", confirm_password: "" },
  })

  const [passwordType, setPasswordType] = React.useState<"password" | "text">(
    "password"
  )
  const [confirmType, setConfirmType] = React.useState<"password" | "text">(
    "password"
  )
  const [done, setDone] = React.useState(false)

  const passwordValue = useWatch({ control, name: "new_password" })

  async function onSubmit(values: ResetPasswordValues) {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: values.new_password }),
    })

    if (!res.ok) {
      const envelope = (await res.json()) as ApiErrorEnvelope
      mapResetPasswordErrorToForm(envelope, setError)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div
        data-slot="reset-password-success"
        className={cn("flex w-full flex-col items-center gap-4 text-center", className)}
      >
        <p role="status" className="text-label-lg text-foreground">
          Senha redefinida com sucesso. Entre com a nova senha.
        </p>
        <Button asChild size="md" className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  const rootError = errors.root?.serverError
  const linkInvalid = rootError?.type === "reset-link-invalid"

  return (
    <form
      data-slot="reset-password-form"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className={cn("flex w-full flex-col gap-4", className)}
      {...props}
    >
      {rootError?.message && (
        <p
          role="alert"
          className="text-caption text-destructive"
          data-slot="form-error"
        >
          {rootError.message}
          {linkInvalid && (
            <>
              {" "}
              <Link href="/forgot-password" className="text-link underline">
                Request a new link
              </Link>
            </>
          )}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="new_password">New password</Label>
        <div className="relative">
          <Input
            id="new_password"
            type={passwordType}
            autoComplete="new-password"
            placeholder="Create a new password"
            className="pr-12"
            aria-invalid={!!errors.new_password}
            {...register("new_password")}
          />
          <PasswordVisibilityToggle
            onTypeChange={setPasswordType}
            className="absolute inset-y-0 right-2 my-auto"
          />
        </div>
        <PasswordStrengthMeter value={passwordValue} />
        <FieldError message={errors.new_password?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm_password">Confirm new password</Label>
        <div className="relative">
          <Input
            id="confirm_password"
            type={confirmType}
            autoComplete="new-password"
            placeholder="Confirm your new password"
            className="pr-12"
            aria-invalid={!!errors.confirm_password}
            {...register("confirm_password")}
          />
          <PasswordVisibilityToggle
            onTypeChange={setConfirmType}
            className="absolute inset-y-0 right-2 my-auto"
          />
        </div>
        <FieldError message={errors.confirm_password?.message} />
      </div>

      <Button type="submit" size="md" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  )
}

export { ResetPasswordForm }
