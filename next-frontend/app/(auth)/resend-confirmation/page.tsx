import { AuthFooter } from "@/components/auth/auth-footer"
import { BrandLogo } from "@/components/auth/brand-logo"
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form"
import { Card } from "@/components/ui/card"

/**
 * Standalone destination of the "Reenviar e-mail de confirmação" link shown by
 * the login form on 403 EMAIL_NOT_CONFIRMED (gap left open by phase-02-auth-frontend;
 * closed by saneamento-fase-02-e-infra/TD-04 — Revisions). Reuses the same form
 * rendered inside the invalid/expired states of /confirm-email.
 */
export default function ResendConfirmationPage() {
  return (
    <main
      data-slot="resend-confirmation-page"
      className="flex flex-1 items-center justify-center bg-background px-6 py-10"
    >
      <Card className="relative w-full max-w-[448px] items-center gap-6 px-6 py-10">
        <BrandLogo size="lg" />

        <h1 className="text-h1 text-foreground text-center">
          Resend confirmation e-mail
        </h1>
        <p className="text-body-md text-muted-foreground text-center">
          Informe o e-mail da sua conta e enviaremos um novo link de confirmação.
        </p>

        <ResendConfirmationForm className="w-full" />

        <AuthFooter
          question="Already confirmed?"
          linkLabel="Sign in"
          linkHref="/login"
        />
      </Card>
    </main>
  )
}
