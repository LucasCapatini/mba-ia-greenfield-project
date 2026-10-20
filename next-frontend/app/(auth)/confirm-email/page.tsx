import {
  ConfirmEmailResult,
  type ConfirmEmailState,
} from "@/components/auth/confirm-email-result"
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form"
import { upstream } from "@/lib/api/upstream"
import { clientHeaders } from "@/lib/api/client-headers"

type SearchParams = Promise<{ token?: string | string[] }>

/**
 * Confirms the account on the first paint — the RSC owns the token
 * (per phase-02-auth-frontend/TD-07). Safe against e-mail-client link
 * prefetch because the upstream is idempotent (saneamento-fase-02-e-infra/TD-03).
 */
async function confirm(token: string): Promise<ConfirmEmailState> {
  // The visitor's IP, so the throttler budgets each person instead of the whole BFF (watch-page/TD-03).
  const { error } = await upstream.GET("/auth/confirm-email", {
    params: { query: { token } },
    headers: await clientHeaders(),
  })

  if (!error) return "success"
  return error.error === "TOKEN_EXPIRED" ? "expired" : "invalid"
}

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { token } = await searchParams
  const rawToken = Array.isArray(token) ? token[0] : token

  // Missing token → invalid without touching the upstream.
  const state: ConfirmEmailState = rawToken ? await confirm(rawToken) : "invalid"

  return (
    <ConfirmEmailResult state={state}>
      {state !== "success" && <ResendConfirmationForm className="w-full" />}
    </ConfirmEmailResult>
  )
}
