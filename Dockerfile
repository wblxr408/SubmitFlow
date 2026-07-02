FROM node:20-alpine AS base

# Stage 1: Install deps
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm config set registry https://registry.npmmirror.com && npm install -g pnpm@9 && pnpm install --frozen-lockfile

# Stage 2: Build
FROM base AS builder
WORKDIR /app
ARG ENCRYPTION_KEY
ARG JWT_SECRET
ENV ENCRYPTION_KEY=${ENCRYPTION_KEY}
ENV JWT_SECRET=${JWT_SECRET}
ENV DOCKER_BUILD=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

RUN apk add --no-cache libc6-compat nss freetype harfbuzz mesa-gbm alsa-lib

# standalone output bundles its own node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# migrate script needs src/db and scripts/
COPY --from=builder --chown=nextjs:nodejs /app/src/db ./src/db
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# standalone doesn't bundle pg, copy node_modules for migrate script
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER root
RUN mkdir -p public/uploads/resumes && chown nextjs:nodejs public/uploads/resumes
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrate then start the app
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
