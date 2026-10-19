---
libs:
  "@aws-sdk/client-s3":
    version: "^3.1152.0"
    context7_id: "n/a — context7 indisponível nesta sessão; documentação oficial via WebFetch"
    fetched_at: "2026-10-18T14:45:00-04:00"
  "@aws-sdk/s3-request-presigner":
    version: "^3.1152.0"
    context7_id: "n/a — context7 indisponível nesta sessão; README oficial via WebFetch"
    fetched_at: "2026-10-18T14:45:00-04:00"
  "pg-boss":
    version: "^12.38.0"
    context7_id: "n/a — context7 indisponível nesta sessão; README + pgboss.io via WebFetch"
    fetched_at: "2026-10-18T14:45:00-04:00"
  "aws-sdk-client-mock":
    version: "^4.1.0"
    context7_id: "n/a — context7 indisponível nesta sessão; README oficial via WebFetch"
    fetched_at: "2026-10-18T14:45:00-04:00"
sources_mtime:
  docs/decisions/technical-decisions-phase-03-upload-processing.md: "2026-10-18T14:40:55-04:00"
---

# Library References — phase-03-upload-processing

_Cache de documentação para as bibliotecas decididas em `technical-decisions-phase-03-upload-processing` (TD-02, TD-04, TD-13). O MCP `context7` não estava disponível; as fontes foram lidas via WebFetch em 2026-10-18: AWS SDK for JavaScript v3 Developer Guide (checksums), README do `@aws-sdk/s3-request-presigner`, Amazon S3 User Guide (multipart upload overview), README do `pg-boss` + pgboss.io, README do `aws-sdk-client-mock`. Versões = `latest` no registro npm em 2026-10-18; nenhuma está instalada ainda (o `implement` fixa o range no `package.json`)._

### @aws-sdk/client-s3

**Uso nesta fase (TD-02, TD-03, TD-09, TD-10):** cliente S3 modular; dois `S3Client` — um com `S3_ENDPOINT` interno (API/worker) e um com `S3_PUBLIC_ENDPOINT` usado **somente** para assinar URLs que o navegador consome (o host faz parte da assinatura SigV4).

```ts
import {
  S3Client, CreateMultipartUploadCommand, UploadPartCommand, ListPartsCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand,
  PutObjectCommand, HeadObjectCommand,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,            // http://rustfs:9000
  region: process.env.S3_REGION,                // 'us-east-1' (obrigatório pelo SDK)
  forcePathStyle: true,                         // bucket no path, não como subdomínio
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',  // ver nota de checksums
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

**Checksums (≥ 3.729.0):** por padrão o SDK calcula CRC32 e envia `x-amz-checksum-*`/trailers em todo upload; servidores S3-compatíveis podem rejeitar. `requestChecksumCalculation: 'WHEN_REQUIRED'` e `responseChecksumValidation: 'WHEN_REQUIRED'` desligam o comportamento automático (configuráveis também por env `AWS_REQUEST_CHECKSUM_CALCULATION`). Um checksum pré-calculado passado explicitamente (`ChecksumSHA256`, etc.) continua sendo enviado.

**Multipart (S3 User Guide):** fluxo `CreateMultipartUpload` (`{ Bucket, Key, ContentType }` → `{ UploadId }`) → `UploadPart` por parte (`PartNumber` 1..10 000, qualquer ordem, reenviar o mesmo número sobrescreve) → `CompleteMultipartUpload` (`{ Bucket, Key, UploadId, MultipartUpload: { Parts: [{ ETag, PartNumber }] } }`). Limites: partes de 5 MiB a 5 GiB, a última pode ser menor; máx. 10 000 partes. `ListParts` devolve as partes já aceitas (até 1 000 por página) — base da retomada; **não** usar seu resultado para montar o `complete`: manter a lista própria de `{ PartNumber, ETag }` devolvida pelo cliente. Multipart não expira sozinho: ou `CompleteMultipartUpload`, ou `AbortMultipartUpload`, ou regra de lifecycle `AbortIncompleteMultipartUpload`. Metadados do objeto (`ContentType`) só são aceitos no `CreateMultipartUpload`.

**GET com Range/Download:** `GetObjectCommand` aceita `Range` (`bytes=0-1023` → 206) e `ResponseContentDisposition: 'attachment; filename="x.mp4"'` — este último vira query `response-content-disposition` na URL pré-assinada (TD-09).

### @aws-sdk/s3-request-presigner

**Uso nesta fase (TD-03, TD-06, TD-09):** URLs pré-assinadas de `UploadPart` (navegador → storage), `GetObject` (player/download e leitura interna pelo `ffprobe`).

```ts
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// UploadPart por parte (TD-03) — assinar com o cliente PÚBLICO
const url = await getSignedUrl(publicS3, new UploadPartCommand({
  Bucket, Key, UploadId, PartNumber,
}), { expiresIn: 3600 });               // default 900 s

// GET de streaming/download (TD-09) — cliente PÚBLICO
const streamUrl = await getSignedUrl(publicS3, new GetObjectCommand({ Bucket, Key }), { expiresIn: PLAYBACK_URL_TTL });
const downloadUrl = await getSignedUrl(publicS3, new GetObjectCommand({
  Bucket, Key, ResponseContentDisposition: `attachment; filename="${name}"`,
}), { expiresIn: PLAYBACK_URL_TTL });

// GET para o ffprobe (TD-06) — cliente INTERNO (host rustfs:9000)
const internalUrl = await getSignedUrl(internalS3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 1800 });
```

**Headers assinados:** por padrão `Content-Type` **não** é assinado; para exigi-lo no PUT, passar `signableHeaders: new Set(['content-type'])` e o cliente deve enviar exatamente o mesmo valor, senão `SignatureDoesNotMatch`. Headers `x-amz-*` que devem ser enviados pelo cliente vão em `unhoistableHeaders`; `hoistableHeaders` move `x-amz-*` para a query string. Para `UploadPart` pré-assinado o cliente não deve adicionar headers não assinados (o checksum automático do SDK não se aplica — o body não existe na assinatura).

### pg-boss

**Uso nesta fase (TD-04, TD-11, TD-12):** fila sobre o PostgreSQL existente; `send` na API e `work` no worker (TD-05); job `video.process` com chave singleton por vídeo; job `upload.expire` atrasado por `UPLOAD_TTL`. Requer Node ≥ 22.12 e PostgreSQL 13+ (projeto: Node 25.6, Postgres 17). Schema próprio `pgboss` criado/migrado por `start()` (opção `migrate`, default true) — segundo mecanismo de migração ao lado do TypeORM, documentar no `CLAUDE.md`.

```ts
import { PgBoss } from 'pg-boss';

const boss = new PgBoss({ connectionString, schema: 'pgboss', migrate: true, supervise: true });
await boss.start();                          // cria/migra o schema, inicia supervisão
await boss.createQueue('video.process');     // obrigatório antes de send/work (v10+)
await boss.createQueue('upload.expire');

// API — TD-11
await boss.send('video.process', { videoId }, {
  singletonKey: `video:${videoId}`,          // um job ativo por vídeo (idempotência)
  retryLimit: 3, retryDelay: 30, retryBackoff: true,
  expireInSeconds: 1800,                     // job travado volta à fila
});

// API — TD-12
await boss.send('upload.expire', { videoId }, {
  singletonKey: `upload:${videoId}`,
  startAfter: new Date(Date.now() + UPLOAD_TTL_MS),
});

// Worker — TD-05
await boss.work('video.process', { batchSize: 1, pollingIntervalSeconds: 2 }, async ([job]) => {
  // retornar = completed; lançar = failed (retry até retryLimit, depois failed/dead letter)
});

await boss.stop();                           // graceful (onModuleDestroy)
```

**Semântica:** o handler recebe um array (`batchSize`); retorno conclui o job, exceção falha e agenda retry conforme `retryLimit/retryDelay/retryBackoff`; esgotados os retries o job fica `failed` (ou vai para `deadLetter` se configurado). `singletonKey` impede dois jobs ativos com a mesma chave na fila (`singletonSeconds` para janela temporal). Políticas de fila em `createQueue(name, { policy: 'standard' | 'short' | 'singleton' | 'stately' })`. `schedule(name, cron, data, options)` para recorrência (não usado nesta fase). Transação compartilhada com o domínio: `send` aceita `db` próprio nas options (passar o `QueryRunner`/cliente da transação do TypeORM) — confirmar a assinatura exata na versão instalada antes da SI de TD-11.

### aws-sdk-client-mock

**Uso nesta fase (TD-13):** mock do `S3Client` nos testes unit (`*.spec.ts`), sem I/O; `aws-sdk-client-mock-jest` para matchers. Compatível com `@aws-sdk/*` ≥ 3.363.0.

```ts
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { S3Client, CreateMultipartUploadCommand, ListPartsCommand } from '@aws-sdk/client-s3';

const s3Mock = mockClient(S3Client);          // todas as instâncias
beforeEach(() => s3Mock.reset());             // limpa comportamento e histórico

s3Mock.on(CreateMultipartUploadCommand, { Bucket: 'streamtube-videos' }).resolves({ UploadId: 'u1' });
s3Mock.on(ListPartsCommand).resolvesOnce({ Parts: [] }).resolves({ Parts: [{ PartNumber: 1, ETag: '"a"' }] });
s3Mock.on(AbortMultipartUploadCommand).rejects(new Error('NoSuchUpload'));

expect(s3Mock).toHaveReceivedCommandWith(CreateMultipartUploadCommand, { ContentType: 'video/mp4' });
expect(s3Mock).toHaveReceivedCommandTimes(UploadPartCommand, 0);
```

**Notas:** matchers mais específicos (`.on(Cmd, input)`) têm precedência sobre os genéricos; `getSignedUrl` não é um comando (é uma função do presigner) — mocke-o com `jest.mock('@aws-sdk/s3-request-presigner')` quando o teste precisar de URLs determinísticas; respostas com stream devem usar `sdkStreamMixin` de `@smithy/util-stream`; manter todas as versões `@aws-sdk/*` iguais para evitar conflito de tipos em `@smithy/types`.
