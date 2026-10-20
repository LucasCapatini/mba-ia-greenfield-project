# Production image (home-search-production/TD-11): one image for the `api`, `worker` and `migrate`
# services of deploy/compose.yaml — the compose swaps the command (`node dist/worker`,
# `npm run migration:run:prod`). Same base as Dockerfile.dev. No bind mount, no dev dependencies.

FROM node:25.6.0-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:25.6.0-slim AS runtime
# ffmpeg/ffprobe for the video worker (phase-03-upload-processing/TD-05, TD-06).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
