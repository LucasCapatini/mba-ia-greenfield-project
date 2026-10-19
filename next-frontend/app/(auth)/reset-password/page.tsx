import Link from "next/link"

import { AuthFooter } from "@/components/auth/auth-footer"
import { BrandLogo } from "@/components/auth/brand-logo"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type SearchParams = Promise<{ token?: string | string[] }>

/**
 * Destination of the password-reset e-mail link. The RSC owns the token
 * (per phase-02-auth-frontend/TD-07); the Client form owns the input and
 * consumes the token on submit through the BFF (saneamento-fase-02-e-infra/TD-04).
 * Without a token there is nothing to reset — no form, just the way back.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { token } = await searchParams
  const rawToken = Array.isArray(token) ? token[0] : token

  return (
    <main
      data-slot="reset-password-page"
      data-state={rawToken ? "form" : "error"}
      className="flex flex-1 items-center justify-center bg-background px-6 py-10"
    >
      <Card className="relative w-full max-w-[448px] items-center gap-6 px-6 py-10">
        <BrandLogo size="lg" />

        {rawToken ? (
          <>
            <h1 className="text-h1 text-foreground text-center">
              Choose a new password
            </h1>
            <p className="text-body-md text-muted-foreground text-center">
              Defina uma nova senha para a sua conta.
            </p>
            <ResetPasswordForm token={rawToken} className="w-full" />
          </>
        ) : (
          <>
            <h1 className="text-h1 text-foreground text-center">
              Invalid reset link
            </h1>
            <p
              role="status"
              className="text-body-md text-muted-foreground text-center"
            >
              Este link de redefinição é inválido. Solicite um novo link para
              continuar.
            </p>
            <Button asChild size="md" className="w-full">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </>
        )}

        <AuthFooter
          question="Remember your password?"
          linkLabel="Sign in"
          linkHref="/login"
        />
      </Card>
    </main>
  )
}
