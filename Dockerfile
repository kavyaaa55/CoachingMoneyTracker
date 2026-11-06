# Dependencies, shared by the stages below.
# An LTS release. Odd-numbered Node versions are short-lived, so never use them here.
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build. These placeholders only let the build read its settings. Nothing connects, and none of
# them reach the final image.
FROM deps AS build
COPY . .
RUN BUILD_STANDALONE=true \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    SESSION_SECRET=build-placeholder-build-placeholder-000 \
    GATEWAY_WEBHOOK_SECRET=build-placeholder-build-placeholder-000 \
    CRON_SECRET=build-placeholder-build-placeholder-000 \
    npm run build

# Migrations and sample data. Has the full toolchain, and runs once, not as the web server.
FROM build AS tools
CMD ["npm", "run", "db:migrate"]

# The web server: only what it needs, running as a non-root user.
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
