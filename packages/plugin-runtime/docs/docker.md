# Docker Image Build and Runtime

## Auto-generated Dockerfile

When no custom Dockerfile exists, Autokestra generates:

```dockerfile
FROM oven/bun:1.0
COPY . /plugin
WORKDIR /plugin
RUN bun install
CMD ["bun", "run", "index.ts"]
```

## Runtime Expectations

- Plugin entry point: `index.ts` in plugin root
- Input: JSON via stdin
- Output: JSON via stdout
- Exit code 0 on success, non-zero on failure
- Network: `--network=none` for restricted mode
- Volumes: explicit mounts for filesystem access