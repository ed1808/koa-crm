# Stage 1: Build the React application
FROM oven/bun:1-slim AS builder

WORKDIR /app

# Copy root workspace and frontend package configuration
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy frontend source files
COPY frontend/ ./frontend/

WORKDIR /app/frontend

# Build argument to allow specifying a custom API URL if needed
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Build production assets
RUN bun run build

# Stage 2: High-performance Nginx web server
FROM nginx:alpine AS runner

# Remove default nginx config and copy custom one
RUN rm -f /etc/nginx/conf.d/default.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
