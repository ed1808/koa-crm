# Multi-stage Bun build for KOA CRM Backend
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy root workspace configurations and backend package
COPY package.json bun.lock ./
COPY backend/package.json ./backend/

# Install dependencies using bun workspace
RUN bun install --frozen-lockfile --production

# Copy backend source files and database schema
COPY backend/ ./backend/

WORKDIR /app/backend

# Environment setup
ENV NODE_ENV=production
ENV PORT=3001
ENV AUTO_MIGRATE=true

EXPOSE 3001

CMD ["bun", "src/index.ts"]
