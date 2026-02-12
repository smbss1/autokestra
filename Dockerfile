# syntax=docker/dockerfile:1

# Multi-stage build: compile the Autokestra server into a standalone binary.

FROM oven/bun:1 AS deps
WORKDIR /app

# Install dependencies.
# Note: Bun workspaces need the workspace directory structure (each package's folder + package.json).
COPY package.json bun.lock tsconfig.json ./
COPY packages ./packages
COPY plugins ./plugins
RUN bun install

FROM deps AS build
WORKDIR /app
COPY . .

# Build a standalone server binary (no CLI included in the final image).
RUN bun build --compile --target=bun packages/server/src/entrypoint.ts --outfile /app/autokestra-server

FROM debian:bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /usr/local/bin/bun /usr/local/bin/bun
COPY --from=build /app/autokestra-server /usr/local/bin/autokestra-server

ENV AUTOKESTRA_CONFIG=/config/config.yaml
EXPOSE 7233

CMD ["autokestra-server"]
