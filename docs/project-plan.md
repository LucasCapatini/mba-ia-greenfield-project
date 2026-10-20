# StreamTube — Planejamento Geral do Projeto

## 1. Visão Geral

O StreamTube é uma plataforma de compartilhamento de vídeos onde usuários cadastrados podem fazer upload, gerenciar e publicar vídeos. Usuários anônimos podem assistir livremente, enquanto funcionalidades sociais como comentários, inscrições e likes são exclusivas de usuários autenticados.

### Principais Características

- **Acesso anônimo:** qualquer pessoa pode assistir vídeos sem cadastro.
- **Cadastro com confirmação:** registro via e-mail com confirmação obrigatória. O prefixo do e-mail se torna o nome do canal.
- **Upload robusto:** suporte a arquivos de até 10GB sem impactar a performance do sistema.
- **Gerenciamento de vídeos:** rascunhos, edição de informações, visibilidade pública/unlisted, thumbnails customizadas.
- **Interações sociais:** likes/dislikes, comentários com respostas, inscrição em canais.
- **Canais:** cada usuário possui um canal com página pública e painel de administração.
- **Recuperação de senha:** fluxo completo de reset via e-mail.
- **Sugestões:** vídeos relacionados por categoria exibidos na sidebar.

### Stack Tecnológica

- **Frontend:** Next.js
- **Backend:** Nest.js
- **Banco de dados:** PostgreSQL

---

## 2. Arquitetura do Software

Veja o diagrama de arquitetura do projeto: [software-arch.mermaid](diagrams/software-arch.mermaid)

---

## 3. Fases do Projeto

### Fase 01 — Configuração Base do Projeto

Preparação de toda a fundação do projeto: repositório, ambiente de desenvolvimento, projetos Next.js e Nest.js, banco de dados PostgreSQL e serviços auxiliares.

- Repositório com estrutura de monorepo (frontend e backend)
- Projeto Next.js (frontend) (será criado depois, não agora) e Nest.js (backend) inicializados
- Ambiente de desenvolvimento local com todos os serviços via Docker Compose
- Estrutura inicial do banco de dados PostgreSQL (schema, migrations e seeds) (sem tabelas ainda)
- Fundação de IA para coding.

**Entregáveis:** ambiente de desenvolvimento funcional, banco de dados configurado.

---

### Fase 02 — Cadastro, Login e Gerenciamento de Conta

> Depende de: Fase 01

Fluxo completo de criação de conta, confirmação por e-mail, login, logout e recuperação de senha.

- Serviço de envio de e-mails transacionais
- Cadastro de usuário com e-mail e senha
- Criação automática do canal do usuário a partir do prefixo do e-mail
- Confirmação de conta via e-mail com link de ativação
- Login e controle de sessão do usuário
- Logout
- Recuperação de senha: solicitação via e-mail → link com token → redefinição
- Telas de cadastro, login, confirmação de conta e recuperação de senha

**Entregáveis:** fluxo completo de cadastro → confirmação → login → recuperação de senha funcionando. Canal criado automaticamente para cada usuário.

_Status (2026-10-18): concluída em três fatias — `docs/phases/phase-02-auth/` (backend), `docs/phases/phase-02-auth-frontend/` (telas de signup/login/forgot-password + BFF) e `docs/tasks/task-saneamento-fase-02-e-infra/` (telas de confirmação de conta, redefinição e reenvio, logout no header, links de e-mail via `FRONTEND_URL`, rede Docker compartilhada e gate de OpenAPI em CI)._

---

### Fase 03 — Upload e Processamento de Vídeos

> Depende de: Fase 01, Fase 02

Upload de arquivos grandes sem travar o sistema, processamento automático do vídeo e geração de URL única.

- Serviço de armazenamento de arquivos (vídeos e thumbnails)
- Serviço de processamento em segundo plano (filas)
- Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance
- Pré-cadastro automático do vídeo como rascunho ao iniciar o upload
- Processamento automático do vídeo após upload (extração de duração e metadados)
- Geração automática de thumbnail a partir de um frame do vídeo
- URL única por vídeo, sem conflito com outros vídeos
- Reprodução via streaming (sem necessidade de download completo)
- Download do vídeo pelo usuário

**Entregáveis:** upload de até 10GB funcional, processamento automático do vídeo, streaming funcionando, URLs únicas geradas.

_Status (2026-10-18): concluída no backend — `docs/phases/phase-03-upload-processing/` (RustFS + multipart pré-assinado, pg-boss, worker como segundo entrypoint com ffprobe/ffmpeg, endpoints de upload/estado/playback, contrato OpenAPI sincronizado). Sem telas nesta fase: a UI de upload entrou na Fase 04 com o estúdio do canal._

---

### Fase 04 — Gerenciamento de Vídeos e Canal

> Depende de: Fase 02, Fase 03

Edição das informações do vídeo, fluxo de rascunho e publicação, painel de administração do canal e página pública.

- Categorias de vídeo disponíveis na plataforma
- Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada
- Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)
- Fluxo de rascunho → publicação
- Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)
- Edição de vídeos a partir do painel
- Edição das informações do canal: nickname, nome e descrição
- Página pública do canal com informações e listagem de vídeos

**Entregáveis:** edição completa de vídeos, rascunho/publicação, painel de gerenciamento, edição de canal, página pública do canal.

_Status (2026-10-19): concluída (backend + frontend) — `docs/phases/phase-04-video-channel-management/` (categorias por migration, `status` + `visibility` + `published_at` com ações dedicadas de publicar/despublicar, thumbnail customizada validada e normalizada com `sharp`, exclusão por hard delete + job `video.delete`, listagens por cursor, leitura pública com auth opcional, contadores denormalizados zerados até as Fases 05/06; no frontend, estúdio com upload multipart do navegador, painel, edição de vídeo e de canal, e a página pública do canal). A dívida de lint do backend (specs/e2e das Fases 02/03) e a validação de nicknames reservados/curtos no cadastro foram saneadas em `docs/tasks/task-saneamento-fase-04/`. Pendência: reauditoria do frame Figma 154:1724 (e do valor escuro de `--progress-track`)._

---

### Fase 05 — Página de Visualização do Vídeo

> Depende de: Fase 03, Fase 04

Página onde o usuário assiste ao vídeo com player funcional, descrição, sugestões e acesso anônimo.

- Player de vídeo com controles: play/pause, volume e barra de progresso
- Layout da página: vídeo principal + informações + sidebar com sugestões
- Descrição do vídeo com expansão/recolhimento
- Contagem de visualizações
- Sugestões de vídeos da mesma categoria na sidebar
- Acesso anônimo à visualização de vídeos
- Botão de download do vídeo
- Vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens)

**Entregáveis:** página de visualização com player funcional, sidebar de sugestões, download e acesso anônimo.

_Status (2026-10-19): concluída (backend + frontend) — `docs/phases/phase-05-watch-page/` (`GET /videos/{publicId}` com o canal; `POST /videos/{publicId}/views` com dedup diária por espectador em `video_views` + job agendado `video-views.cleanup`; `GET /videos/{publicId}/related` com mesma categoria primeiro; IP real do visitante atrás do BFF via `TRUST_PROXY` + IP fixo do `next-frontend`; no frontend, BFF com sessão opcional, `VideoPlayer` com controles próprios, renovação da URL assinada e registro único de visualização, página `/watch/{publicId}` com estados 404/processando/erro e o mesmo player no preview do estúdio). Auditoria visual feita contra PNGs exportados do Figma (MCP sem cota). Pendência: o `X-Forwarded-For` enviado pelo navegador é mantido pelo `next start`, então o deploy precisa de um proxy reverso que o sobrescreva (`watch-page/TD-03`, Revisions 2026-10-19). As demais pendências da fase — volume nomeado do `db`, `ip_range` na rede `streamtube`, colisão entre `--text-overlay` e `--color-overlay`, `requestOrigin` duplicado e o alias do shadcn CLI — foram resolvidas em `docs/tasks/task-manutencao-pos-fase-05/`._

---

### Fase 06 — Interações Sociais (Likes, Comentários, Inscrições)

> Depende de: Fase 02, Fase 05

Likes/dislikes em vídeos e comentários, comentários com respostas e inscrição em canais.

- Like e dislike em vídeos (usuários autenticados)
- Comentários em vídeos (usuários autenticados)
- Respostas a comentários (comentários aninhados)
- Like e dislike em comentários (usuários autenticados)
- Inscrição em canais (seguir/deixar de seguir)
- Área de canais seguidos com acesso rápido aos vídeos
- Contagem de inscritos na página do canal
- Interface completa de comentários, likes e inscrições

**Entregáveis:** likes/dislikes funcionando, comentários com respostas, inscrição em canais, listagem de canais seguidos.

_Status (2026-10-20): concluída (backend + frontend) — `docs/phases/phase-06-social-interactions/` (migration `CreateSocialInteractions` com `video_reactions`, `comments`, `comment_reactions`, `subscriptions` e `channels.subscriber_count`; contadores ajustados na mesma transação por SQL direto, sem tocar no `updated_at`; `PUT|DELETE` idempotentes de reação a vídeo e comentário e de inscrição — próprio canal → 422; comentários paginados por `latest`/`top`, respostas em um nível, edição e exclusão só pelo autor; `viewer_reaction`/`viewer_subscribed`/`subscriber_count` nas leituras; `GET /me/subscriptions` e `GET /me/subscriptions/videos`; no frontend, rotas BFF, `useOptimisticMutation` com reconciliação pela resposta, grupo de rotas `(shell)` com menu lateral e canais seguidos, watch page com like/dislike, Subscribe e comentários, inscritos na página do canal e `/feed/subscriptions` protegido pelo `proxy.ts`). Auditoria visual feita contra PNGs exportados do Figma (sem MCP). Pendências: `VideoViewsService` (Fase 05) usa `increment`, que altera `videos.updated_at` e com isso a URL da thumbnail; suítes de integração sociais só limpam o banco no `beforeEach`; o composer de comentários ainda monta o link de login à mão em vez de `loginHref`; o avatar de iniciais pequeno é ajustado por seletor descendente em vez de uma variante do `ChannelAvatar`._

---

### Fase 07 — Página Inicial, Busca e Finalização

> Depende de: todas as fases anteriores

Home page com listagem de vídeos, busca, navegação geral, responsividade e preparação para produção.

- Página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação)
- Filtro de vídeos por categoria na home
- Barra de busca (pesquisa por título e canal)
- Header/navbar com logo, barra de busca, botão de login/avatar e navegação
- Paginação ou scroll infinito nas listagens de vídeos
- Layout responsivo para dispositivos móveis
- Testes dos fluxos principais da plataforma
- Ambiente de produção e deploy

**Entregáveis:** home page, busca, navegação, responsividade, testes realizados e ambiente de produção configurado.

---

## 4. Pontos de Atenção

- **Upload de arquivos grandes:** o upload de até 10GB precisa ser feito de forma que não trave o sistema e permita retomar em caso de falha de conexão.
- **Processamento de vídeos:** a extração de informações do vídeo é pesada e deve acontecer em segundo plano, sem bloquear o usuário.
- **URLs únicas:** cada vídeo precisa de uma URL curta e única que nunca conflite com outro vídeo.
- **Armazenamento:** vídeos grandes consomem muito espaço. É importante planejar o crescimento e os custos de armazenamento desde o início.
- **Streaming:** o vídeo deve começar a ser reproduzido sem que o usuário precise baixar o arquivo inteiro.
- **Comentários aninhados:** definir até quantos níveis de resposta serão permitidos para manter a interface organizada.
- **Like/dislike anônimo:** como qualquer usuário pode dar like/dislike, é preciso evitar abusos (ex: múltiplos likes do mesmo usuário).