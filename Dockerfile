FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
COPY --from=builder /app/dist/ ./dist/
COPY docs/ ./docs/
COPY SKILL.md PLAYBOOK.md ANDROMEDA.md ./
COPY --chmod=755 scripts/docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:${PORT:-3000}/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
