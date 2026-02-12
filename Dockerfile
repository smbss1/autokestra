# syntax=docker/dockerfile:1

# Multi-stage build: compile the Autokestra server into a standalone binary.

FROM oven/bun:1 AS deps
WORKDIR /app

# Install dependencies.
# Note: Bun workspaces need the workspace directory structure (each package's folder + package.json).
COPY package.json bun.lock tsconfig.json ./
COPY packages ./packages
COPY plugins ./plugins
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .

# Build a standalone server binary (no CLI included in the final image).
RUN bun build --compile --target=bun packages/server/src/entrypoint.ts --outfile /app/autokestra-server

FROM debian:bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /usr/local/bin/bun /usr/local/bin/bun
COPY --from=build /app/autokestra-server /usr/local/bin/autokestra-server

ENV AUTOKESTRA_CONFIG=/config/config.yaml
EXPOSE 7233

CMD ["autokestra-server"]
