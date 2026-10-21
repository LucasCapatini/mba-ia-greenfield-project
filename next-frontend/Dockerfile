# Production image (home-search-production/TD-11): Next.js `standalone` output served by its own
# `server.js`. API_URL and SESSION_PASSWORD are runtime variables, so the env validation of
# lib/env.ts is skipped only while building. MSW_ENABLED is never set here — the upstream is real.

FROM node:22.16.0-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN SKIP_ENV_VALIDATION=true npm run build

FROM node:22.16.0-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
