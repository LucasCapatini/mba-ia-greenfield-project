import type { ReactionState, ReactionValue } from "@/lib/api/contracts"

/**
 * Próximo estado de um par like/dislike ao clicar em `clicked` (social-interactions/TD-03): clicar
 * no ativo remove a reação (`DELETE`); clicar no outro troca ou cria (`PUT { value }`). As
 * contagens seguem o mesmo delta do backend (TD-02), para o otimista bater com a resposta.
 */
export function nextReaction(
  state: ReactionState,
  clicked: ReactionValue
): { next: ReactionState; method: "PUT" | "DELETE" } {
  const previous = state.viewer_reaction
  const reaction = previous === clicked ? null : clicked
  const score = (value: ReactionValue | null, target: ReactionValue) =>
    value === target ? 1 : 0
  return {
    next: {
      viewer_reaction: reaction,
      like_count: state.like_count + score(reaction, "like") - score(previous, "like"),
      dislike_count:
        state.dislike_count + score(reaction, "dislike") - score(previous, "dislike"),
    },
    method: reaction === null ? "DELETE" : "PUT",
  }
}

/** `fetch` da mutação de reação no BFF (`PUT { value }` ou `DELETE`). */
export function sendReaction(
  url: string,
  method: "PUT" | "DELETE",
  value: ReactionValue | null
): Promise<Response> {
  return method === "PUT"
    ? fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      })
    : fetch(url, { method })
}
