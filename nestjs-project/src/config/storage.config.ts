import { registerAs } from '@nestjs/config';

// Object storage S3-compatível (RustFS em dev; S3 real em produção).
// `endpoint` é o host interno (nome do serviço Compose) usado pela API e pelo worker;
// `publicEndpoint` é o host alcançável pelo navegador e serve SOMENTE para assinar
// URLs pré-assinadas (a assinatura SigV4 fixa o host) — phase-03-videos/TD-01, TD-02.
export default registerAs('storage', () => ({
  endpoint: process.env.S3_ENDPOINT ?? 'http://rustfs:9000',
  publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  accessKey: process.env.S3_ACCESS_KEY ?? '',
  secretKey: process.env.S3_SECRET_KEY ?? '',
  bucket: process.env.S3_BUCKET ?? 'streamtube-videos',
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
}));
