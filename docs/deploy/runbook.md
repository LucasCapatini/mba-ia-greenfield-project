# Runbook de produção — StreamTube

Do zero ao primeiro deploy e à operação do dia a dia. Decisões: `docs/decisions/technical-decisions-home-search-production.md` (TD-06 a TD-11). Arquivos: `deploy/compose.yaml`, `deploy/Caddyfile`, `deploy/.env.example`, `deploy/backup.sh`, `.github/workflows/ci.yml` e `.github/workflows/deploy.yml`.

## Visão geral

```
navegador ──https──> Caddy (80/443, TLS automático) ──> web (Next.js standalone, BFF) ──> api (NestJS)
                                                                                        ├─> db (PostgreSQL 17, volume)
                                                         worker (FFmpeg, pg-boss) ──────┤
                                                         migrate (one-shot)             └─> AWS S3 (vídeos, thumbnails, backups)
                                                                                        └─> SMTP transacional
```

- Uma VPS com Docker roda tudo pelo `deploy/compose.yaml`. Só o Caddy publica portas (80/443). API, worker e `migrate` usam a mesma imagem (`ghcr.io/<owner>/streamtube-api`), e o frontend usa a `streamtube-web`.
- O navegador envia e baixa os vídeos **direto do S3** por URLs pré-assinadas. As thumbnails são públicas por URL estável. Os bytes de vídeo nunca passam pela VPS.
- O Caddy **sobrescreve** o `X-Forwarded-For` com o IP real do cliente. A API só aceita esse header vindo do IP fixo do `web` (`TRUST_PROXY=172.31.0.10`). Um header forjado não escolhe o orçamento de rate limit de outra pessoa (validado localmente).
- Deploy: push em `main` → gates do CI (`backend`, `frontend`, `full-stack`) → imagens no GHCR com a tag do SHA → SSH na VPS (`pull`, `migrate`, `up -d`) → smoke somente leitura contra `https://$DOMAIN`.

## (a) VPS

1. Uma VM Linux (Ubuntu 24.04 LTS ou Debian 12) com 2 vCPU, 4 GB de RAM e 40 GB de disco serve para começar. O FFmpeg do worker usa CPU, então dimensione pelo volume de uploads.
2. Instale o Docker Engine com o plugin Compose (guia oficial do Docker para a distribuição) e confira com `docker compose version`.
3. Crie um usuário de deploy no grupo `docker` (ex.: `deploy`) e autorize a chave pública do GitHub Actions em `~deploy/.ssh/authorized_keys`. Gere o par **só** para isso: `ssh-keygen -t ed25519 -f streamtube-deploy -N ""`.
4. Firewall: libere só **22, 80 e 443** (ex.: `ufw default deny incoming && ufw allow 22,80,443/tcp && ufw allow 443/udp && ufw enable`). Desative o login por senha no SSH.
5. Crie o diretório do deploy (padrão `~/streamtube`; outro caminho → variável `DEPLOY_PATH` do Environment `production`).
6. Autentique a VPS no GHCR, porque os pacotes nascem privados: crie um token clássico do GitHub com o escopo **`read:packages`** e rode `echo <token> | docker login ghcr.io -u <usuário-do-github> --password-stdin`. A alternativa é tornar os pacotes `streamtube-api` e `streamtube-web` públicos nas configurações do pacote.

## (b) DNS

- Crie um registro `A` (e `AAAA`, se houver IPv6) do domínio (ex.: `streamtube.exemplo.com`) para o IP da VPS.
- O Caddy obtém o certificado da Let's Encrypt na primeira requisição. As portas 80 e 443 precisam estar abertas e o DNS já propagado (`dig +short streamtube.exemplo.com`).

## (c) Bucket AWS S3

Crie um bucket na região escolhida (ex.: `streamtube-videos` em `us-east-1`), com "Object Ownership: Bucket owner enforced".

1. **Block Public Access:** mantenha bloqueadas as ACLs públicas e **desmarque** só as duas opções de *bucket policies* públicas. A policy abaixo libera leitura anônima apenas em `thumbnails/*`.
2. **Bucket policy** — leitura anônima só das thumbnails (`video-channel-management/TD-10`). `videos/*` e `backups/*` continuam privados:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadThumbnails",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::streamtube-videos/thumbnails/*"
       }
     ]
   }
   ```

3. **CORS** — o navegador faz `PUT` das partes e lê o vídeo direto do bucket. A origem é o `FRONTEND_URL`:

   ```json
   [
     {
       "AllowedOrigins": ["https://streamtube.exemplo.com"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

4. **Lifecycle** — regra "Delete expired object delete markers or incomplete multipart uploads" → *incomplete multipart uploads* após **2 dias**. É maior que o `UPLOAD_TTL` de 24 h e funciona como rede de segurança do job `upload.expire` (`phase-03-upload-processing/TD-12`).
5. **Usuário IAM** só com o necessário (gere a access key e guarde-a no `.env` da VPS):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "Objects",
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListMultipartUploadParts",
           "s3:AbortMultipartUpload"
         ],
         "Resource": "arn:aws:s3:::streamtube-videos/*"
       },
       {
         "Sid": "ListBackups",
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::streamtube-videos",
         "Condition": { "StringLike": { "s3:prefix": ["backups/*"] } }
       }
     ]
   }
   ```

   `s3:PutObject` cobre o multipart (`CreateMultipartUpload`, `UploadPart` e `CompleteMultipartUpload`); `s3:GetObject` cobre o `HeadObject` do worker; `s3:ListBucket` em `backups/` atende a retenção do `backup.sh`.
6. **Endpoints no `.env`:** `S3_ENDPOINT` e `S3_PUBLIC_ENDPOINT` = `https://s3.<região>.amazonaws.com`, `S3_FORCE_PATH_STYLE=false`, `S3_REGION=<região>`.
7. **Confira a URL de thumbnail.** A API monta `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/thumbnails/...` no formato *path-style*. Depois do primeiro upload, `curl -sI https://s3.<região>.amazonaws.com/streamtube-videos/thumbnails/<publicId>/auto.jpg` deve responder `200`. Se a região não aceitar path-style, aponte `S3_PUBLIC_ENDPOINT` para `https://streamtube-videos.s3.<região>.amazonaws.com` e trate o caminho na revisão do TD-09 antes de abrir ao público.

## (d) SMTP transacional

- Contrate um provedor SMTP transacional, verifique o domínio de envio e publique no DNS os registros **SPF**, **DKIM** (e, de preferência, **DMARC**) indicados pelo provedor. Sem eles, os e-mails de confirmação caem em spam.
- No `.env`: `MAIL_HOST`, `MAIL_PORT` (587 com STARTTLS → `MAIL_SECURE=false`; 465 → `MAIL_SECURE=true`), `MAIL_USER` e `MAIL_PASSWORD` (sempre juntos — a API não sobe com só um deles) e `MAIL_FROM` com o domínio verificado.

## (e) `.env` de produção

Na VPS, em `$DEPLOY_PATH/deploy/.env` (nunca no git — `deploy/.gitignore`):

```bash
mkdir -p ~/streamtube/deploy && cd ~/streamtube
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/deploy/.env.example -o deploy/.env   # ou copie do repositório
chmod 600 deploy/.env
openssl rand -base64 48   # gere um valor para SESSION_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET e DB_PASSWORD (um por chave)
```

Preencha `DOMAIN`, `GHCR_OWNER` (dono do repositório em minúsculas), `FRONTEND_URL`/`APP_URL` (`https://$DOMAIN`), os segredos gerados, `DB_*`, `MAIL_*` e `S3_*`. O `IMAGE_TAG` do arquivo só vale num `up` manual, porque o deploy exporta a tag do SHA. Nunca defina `MSW_ENABLED`.

## (f) GitHub: Environment `production` e proteção de branch

Em *Settings → Environments → production* (opcionalmente com *required reviewers*):

| Secret | Valor |
|---|---|
| `SSH_HOST` | IP ou hostname da VPS |
| `SSH_USER` | usuário de deploy (ex.: `deploy`) |
| `SSH_PRIVATE_KEY` | chave privada gerada em (a)3 |
| `DOMAIN` | domínio público (usado pelo smoke) |
| `SSH_KNOWN_HOSTS` (recomendado) | saída de `ssh-keyscan -H <host>` conferida contra a VPS; sem ele, o job faz o scan na hora |

Variáveis opcionais: `DEPLOY_PATH` (padrão `~/streamtube`) e `SMOKE_VIDEO_ID` (um vídeo publicado cuja reprodução o smoke verifica).

Sem os quatro secrets obrigatórios, o job `deploy` falha no primeiro passo, antes de acessar a VPS.

**Ligar o deploy:** o job `deploy` só roda com a **variável de repositório** `DEPLOY_ENABLED` = `true` (*Settings → Secrets and variables → Actions → Variables → New repository variable*). Precisa ser de repositório, não do Environment, porque o `if` do job é avaliado antes de o Environment ser aplicado. Sem ela, o push em `main` roda os gates e publica as imagens no GHCR, e o job `deploy` aparece como *skipped*. É o estado padrão enquanto não houver VPS. Crie a variável só depois de concluir (a)–(f).

Proteção de branch: em `main`, exija os checks `backend`, `frontend`, `full-stack` e `openapi.json + types.gen.ts em sincronia` (o GitHub nomeia o check pelo job do workflow `openapi-freshness`); em `dev`, exija `backend`, `frontend` e `openapi.json + types.gen.ts em sincronia`. Um check só aparece na lista depois de rodar uma vez.

## (g) Backup e restauração

- Agende o `deploy/backup.sh` (copiado a cada deploy) no cron do usuário de deploy:

  ```cron
  30 3 * * * cd ~/streamtube && deploy/backup.sh >> ~/streamtube/backup.log 2>&1
  ```

  Ele gera `pg_dump -Fc` do `db`, envia para `s3://$S3_BUCKET/$BACKUP_PREFIX/streamtube-<data>.dump` (prefixo privado) e apaga os arquivos mais antigos que `BACKUP_RETENTION_DAYS` (padrão 14).
- Confira de vez em quando: `aws s3 ls s3://<bucket>/backups/` e `pg_restore --list <arquivo>`.
- **Restauração** (com a aplicação parada para não gravar no meio):

  ```bash
  cd ~/streamtube
  set -a; . deploy/.env; set +a           # DB_USERNAME, DB_NAME
  C="docker compose -f deploy/compose.yaml --env-file deploy/.env"
  $C stop web api worker
  aws s3 cp s3://<bucket>/backups/<arquivo>.dump .          # ou baixe pelo console
  $C exec -T db pg_restore -U "$DB_USERNAME" -d "$DB_NAME" --clean --if-exists < <arquivo>.dump
  $C up -d
  ```

- Os objetos do bucket (vídeos e thumbnails) não entram no dump. Para protegê-los, ligue o *Versioning* do bucket ou a replicação, se o orçamento permitir.

## (h) Primeiro deploy, rollback e pós-deploy

**Primeiro deploy**

0. Crie a variável de repositório `DEPLOY_ENABLED=true` (seção f). Sem ela, o merge em `main` não faz deploy.

1. Conclua (a)–(f).
2. Faça merge de `dev` em `main`. O workflow `deploy` roda os gates, publica as imagens e faz o deploy. Para disparar antes do primeiro merge, use *Run workflow* com `image_tag` de uma imagem já publicada.
3. Acompanhe pelo job: `pull` → `up -d --wait db` → `run --rm migrate` (migrations a partir de `dist/`) → `up -d` → smoke.
4. Abra `https://$DOMAIN`, crie uma conta (o e-mail precisa chegar), envie um vídeo curto e confira o processamento, a thumbnail pública e a reprodução.

**Rollback**

- *Actions → deploy → Run workflow* com `image_tag` = SHA do último deploy bom (as tags estão nos pacotes do GHCR). Não há rebuild nem gates: o job só faz pull daquela tag e sobe de novo.
- As migrations são só para frente. Se a versão revertida não conhece o schema novo, restaure o backup anterior ao deploy (g) ou publique uma correção para frente.

**Pós-deploy e operação**

```bash
cd ~/streamtube && set -a && . deploy/.env && set +a
C="docker compose -f deploy/compose.yaml --env-file deploy/.env"
$C ps                                  # todos "running"; migrate "exited (0)"
$C logs -f --tail 100 api worker web caddy
$C logs worker | grep "video.delete failed"   # objetos órfãos para remover à mão (aws s3 rm), ver nestjs-project/CLAUDE.md
$C exec db psql -U "$DB_USERNAME" -d "$DB_NAME" -c "select processing_status, count(*) from videos group by 1"
```

- Falha no smoke marca o deploy como falho e deixa o relatório como artefato. Corrija ou faça o rollback.
- Certificados: o Caddy renova sozinho, e os volumes `caddy_data`/`caddy_config` guardam o estado. Não use `down -v` na VPS: isso apagaria também o `pg_data`.

## Validar localmente antes de provisionar

O mesmo compose sobe numa máquina de teste com RustFS e Mailpit no lugar do S3 e do SMTP (`deploy/compose.local.yaml`):

```bash
cp deploy/.env.example deploy/.env      # GHCR_OWNER=local, IMAGE_TAG=validation; o resto pode ficar como está
C="docker compose -f deploy/compose.yaml -f deploy/compose.local.yaml --env-file deploy/.env --profile local-validation"
$C up -d --build                         # migrate termina com 0 antes de api/worker
curl -k https://localhost                # 200 — CA local do Caddy
COMPOSE_FILES="-f deploy/compose.local.yaml --profile local-validation" BACKUP_S3_ENDPOINT=http://rustfs:9000 deploy/backup.sh
(cd next-frontend && FULL_STACK_BASE_URL=https://localhost FULL_STACK_IGNORE_HTTPS_ERRORS=true npx playwright test -c playwright.full-stack.config.ts --grep @smoke)
$C down -v && rm deploy/.env
```

Mailpit UI em `http://localhost:8125`, RustFS em `http://localhost:9100`. O upload do navegador não funciona nesse modo, porque o RustFS fala http sob uma página https (mixed content). Em produção o S3 é https.
