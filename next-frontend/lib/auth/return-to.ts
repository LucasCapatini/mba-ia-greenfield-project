/**
 * Destino pós-login vindo de `?returnTo=` (o `proxy.ts` do estúdio preenche). Só caminhos
 * relativos do próprio site são aceitos — `//host`, `/\host`, esquemas (`https:`, `javascript:`)
 * e qualquer outro valor caem em `/`, para o login não virar um open redirect.
 */
export function safeReturnTo(value: string | string[] | undefined | null): string {
  const candidate = Array.isArray(value) ? value[0] : value
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/\\")
  ) {
    return "/"
  }
  // Uma URL relativa precisa continuar same-origin depois de resolvida.
  try {
    const base = "http://streamtube.invalid"
    const resolved = new URL(candidate, base)
    return resolved.origin === base ? `${resolved.pathname}${resolved.search}${resolved.hash}` : "/"
  } catch {
    return "/"
  }
}
