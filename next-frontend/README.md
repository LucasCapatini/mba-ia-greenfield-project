# next-frontend — Frontend (Next.js 16, App Router)

Interface do StreamTube no modelo **BFF estrito**: o navegador só fala com Route Handlers same-origin em `app/api/**`, que fazem proxy server-side para a API NestJS. Roda em Docker (`docker compose up -d` nesta pasta; o dev server sobe em http://localhost:3001 e exige a stack do backend no ar).

- **Como rodar, testar (Vitest + Playwright) e variáveis de ambiente:** veja o [README raiz](../README.md) § "Como rodar" e § "Testes".
- **Convenções para desenvolvimento (comandos dentro do container, sufixos de teste, MSW, design system/Figma):** veja [`CLAUDE.md`](./CLAUDE.md) deste subprojeto.
- **Tipos da API:** `lib/api/types.gen.ts` é gerado de `openapi.json` via `npm run openapi:types` — nunca edite à mão (ver [`CLAUDE.md` raiz](../CLAUDE.md) § "OpenAPI contract chain").
