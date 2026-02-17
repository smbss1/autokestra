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

# Comma-separated list of built-in plugins to include in the final image.
# Example: --build-arg AUTOKESTRA_CORE_PLUGINS=bash,console
ARG AUTOKESTRA_CORE_PLUGINS=bash,console,http,git-source,script,docker,docker-compose

# Build workspace packages required by runtime imports.
RUN bun run --filter='@autokestra/plugin-sdk' build

# Build selected built-in plugins as published-style artifacts.
RUN rm -rf /app/.core-plugins \
  && mkdir -p /app/.core-plugins \
  && if [ -n "$AUTOKESTRA_CORE_PLUGINS" ]; then \
    OLD_IFS="$IFS"; IFS=','; \
    for plugin in $AUTOKESTRA_CORE_PLUGINS; do \
      plugin="$(echo "$plugin" | xargs)"; \
      [ -z "$plugin" ] && continue; \
      source_dir="/app/plugins/$plugin"; \
      [ -d "$source_dir" ] || { echo "Unknown core plugin: $plugin" >&2; exit 1; }; \
      [ -f "$source_dir/plugin.yaml" ] || { echo "Missing plugin.yaml for core plugin: $plugin" >&2; exit 1; }; \
      [ -f "$source_dir/index.ts" ] || { echo "Missing index.ts for core plugin: $plugin" >&2; exit 1; }; \
      awk '\
        /^[[:space:]]*runtime:[[:space:]]*$/ { in_runtime=1; next } \
        in_runtime && /^[^[:space:]]/ { in_runtime=0 } \
        in_runtime && /^[[:space:]]*entrypoint:[[:space:]]*dist\/index\.js[[:space:]]*$/ { found=1 } \
        END { exit(found ? 0 : 1) }\
      ' "$source_dir/plugin.yaml" \
        || { echo "Plugin '$plugin' must declare runtime.entrypoint: dist/index.js" >&2; exit 1; }; \
      mkdir -p "/app/.core-plugins/$plugin/dist"; \
      cp "$source_dir/plugin.yaml" "/app/.core-plugins/$plugin/plugin.yaml"; \
      bun build --target=bun "$source_dir/index.ts" --outfile "/app/.core-plugins/$plugin/dist/index.js"; \
    done; \
    IFS="$OLD_IFS"; \
  fi

# Build a standalone server binary (no CLI included in the final image).
RUN bun build --compile --target=bun packages/server/src/entrypoint.ts --outfile /app/autokestra-server

FROM debian:bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    docker.io \
  && rm -rf /var/lib/apt/lists/*

# Note: the `docker-compose-plugin` package is not available in the default
# Debian slim repositories. If you need `docker compose` inside the image,
# either install the official Docker apt repository or download the Compose
# CLI plugin binary from the Docker Compose releases and place it under
# `/usr/local/lib/docker/cli-plugins/docker-compose`.

WORKDIR /app
COPY --from=deps /usr/local/bin/bun /usr/local/bin/bun
COPY --from=build /app/autokestra-server /usr/local/bin/autokestra-server
COPY --from=build /app/.core-plugins/ /app/plugins/

ENV AUTOKESTRA_CONFIG=/config/config.yaml
ENV AUTOKESTRA_PLUGIN_PATHS=/app/plugins
EXPOSE 7233

CMD ["autokestra-server"]
