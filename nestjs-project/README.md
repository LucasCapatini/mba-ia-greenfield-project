# nestjs-project — Backend API (NestJS 11)

API REST do StreamTube: autenticação, usuários, canais e e-mails transacionais. Roda **inteiramente em Docker** (`docker compose up -d` nesta pasta sobe API + PostgreSQL + Mailpit).

- **Como rodar, testar e portas:** veja o [README raiz](../README.md) § "Como rodar" e § "Testes".
- **Convenções para desenvolvimento (comandos dentro do container, sufixos de teste, variáveis de ambiente, migrations):** veja [`CLAUDE.md`](./CLAUDE.md) deste subprojeto.
- **Contrato OpenAPI:** `npm run openapi:export` regenera `openapi.json`; a cadeia completa até o frontend está no [`CLAUDE.md` raiz](../CLAUDE.md) § "OpenAPI contract chain".
