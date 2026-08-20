# Dockerfile — Daily Dose of Claude Code UI only.
#
# This container runs the Next.js newspaper UI. It reads/writes the same
# SQLite database that Claude Code hooks and the MCP server on the host use,
# via a volume mount at /data.
#
# NOTE: Claude Code hooks and the MCP server MUST run on the host so Claude
# can spawn them as subprocesses. This container is *only* the UI. Install
# hooks/MCP on the host with `npx daily-dose install` (or `curl … | bash`).

FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install build deps for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.node.json next.config.mjs postcss.config.mjs tailwind.config.ts next-env.d.ts ./
COPY src ./src
COPY scripts ./scripts
COPY public ./public

# Build hooks/MCP (used by scripts/reset/backup/doctor) and the Next.js app
RUN npm run build:node
RUN npx next build

# Runtime image
FROM node:20-bookworm-slim
WORKDIR /app

# better-sqlite3 needs libc; slim already has glibc but keep it minimal.
ENV NODE_ENV=production \
    DAILY_DOSE_HOME=/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/next.config.mjs /app/next-env.d.ts /app/tsconfig.json /app/tsconfig.node.json ./
COPY --from=build /app/bin ./bin

EXPOSE 3000

# Health check hits /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
