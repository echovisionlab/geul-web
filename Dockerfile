# syntax=docker/dockerfile:1@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS base
RUN apk add --no-cache bash git libc6-compat font-noto-arabic font-noto-thai
ARG PNPM_VERSION=11.22.0
RUN corepack enable pnpm && corepack prepare pnpm@${PNPM_VERSION} --activate
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm/store
ENV PATH=${PNPM_HOME}:${PATH}
ENV NEXT_TELEMETRY_DISABLED=1
ENV HUSKY=0
RUN pnpm config set store-dir ${PNPM_STORE_DIR}

FROM base AS deps
WORKDIR /app
COPY --link pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY --link patches ./patches
COPY --link tooling/typescript-eslint ./tooling/typescript-eslint
COPY --link tooling/typescript6 ./tooling/typescript6
RUN pnpm fetch --frozen-lockfile
RUN pnpm install --frozen-lockfile --offline

FROM base AS builder
ARG RELEASE_IMAGE_BUILD=false
WORKDIR /app
COPY --link --from=deps /app/ ./
COPY --link . ./
# Build-time placeholders required for env validation during `next build`.
ENV OATHKEEPER_URL=http://localhost:8000 \
    KRATOS_URL=http://localhost:4433 \
    KRATOS_ADMIN_URL=http://localhost:4434 \
    HYDRA_ADMIN_URL=http://localhost:4445 \
    MCP_OAUTH_ISSUER_URL=http://sso.localhost:4444 \
    SITE_ORIGIN=http://localhost:3000 \
    SESSION_COOKIE_NAME=site_session \
    DRAFT_SECRET=build-time-placeholder-secret123 \
    ENCRYPTION_SECRET=build-time-placeholder-secret123 \
    HOST=localhost \
    RELEASE_IMAGE_BUILD=${RELEASE_IMAGE_BUILD}
RUN pnpm prepare:maplibre-worker
RUN pnpm prepare:p5-runtime
RUN pnpm exec next build

FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat font-noto-arabic font-noto-thai
RUN addgroup -S -g 1001 nodejs \
    && adduser -S -u 1001 -G nodejs nextjs
ENV NODE_ENV=production PORT=3000 HOSTNAME="0.0.0.0" NEXT_TELEMETRY_DISABLED=1
COPY --link --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --link --from=builder --chown=1001:1001 /app/CHANGELOG.md ./CHANGELOG.md
COPY --link --from=builder --chown=1001:1001 /app/.next/static ./.next/static
COPY --link --from=builder --chown=1001:1001 /app/public ./public
RUN mkdir -p .next/cache \
    && chown nextjs:nodejs .next .next/cache
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
