import * as React from "react"
import Link from "next/link"

import { AuthFooter } from "@/components/auth/auth-footer"
import { BrandLogo } from "@/components/auth/brand-logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ConfirmEmailState = "success" | "invalid" | "expired"

type ConfirmEmailResultProps = React.ComponentProps<"main"> & {
  state: ConfirmEmailState
  /** Slot rendered under the message — the resend form on `invalid` / `expired`. */
  children?: React.ReactNode
}

const COPY: Record<ConfirmEmailState, { title: string; description: string }> =
  {
    success: {
      title: "Email confirmed",
      description: "Sua conta foi confirmada. Você já pode entrar.",
    },
    invalid: {
      title: "Invalid confirmation link",
      description:
        "Este link é inválido ou já foi utilizado. Informe seu e-mail para receber um novo link de confirmação.",
    },
    expired: {
      title: "Confirmation link expired",
      description:
        "Este link expirou. Informe seu e-mail para receber um novo link de confirmação.",
    },
  }

/**
 * Server component. Same composition as the other auth screens
 * (Card + BrandLogo + heading + copy + footer) per saneamento-fase-02-e-infra/TD-04.
 */
function ConfirmEmailResult({
  state,
  children,
  className,
  ...props
}: ConfirmEmailResultProps) {
  const { title, description } = COPY[state]

  return (
    <main
      data-slot="confirm-email-result"
      data-state={state}
      className={cn(
        "flex flex-1 items-center justify-center bg-background px-6 py-10",
        className
      )}
      {...props}
    >
      <Card className="relative w-full max-w-[448px] items-center gap-6 px-6 py-10">
        <BrandLogo size="lg" />

        <h1 className="text-h1 text-foreground text-center">{title}</h1>
        <p
          role="status"
          className="text-body-md text-muted-foreground text-center"
        >
          {description}
        </p>

        {state === "success" ? (
          <Button asChild size="md" className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        ) : (
          children
        )}

        <AuthFooter
          question={
            state === "success" ? "Need another account?" : "Already confirmed?"
          }
          linkLabel={state === "success" ? "Sign up" : "Sign in"}
          linkHref={state === "success" ? "/signup" : "/login"}
        />
      </Card>
    </main>
  )
}

export { ConfirmEmailResult }
export type { ConfirmEmailState }
