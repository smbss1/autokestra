# Contributing to Autokestra

## Development Workflow

### Prerequisites

- Bun runtime (latest version)
- Git

### Setup

1. Fork and clone the repository
2. Install dependencies: `bun install`
3. Create a feature branch: `git checkout -b feature/your-feature`

### Code Quality

Before committing:

```bash
# Lint code
bun run lint

# Format code
bun run format

# Run tests
bun run test
```

### Common Commands

- `bun run build`: Build all packages
- `bun run lint`: Check code style
- `bun run format`: Format code
- `bun run test`: Run unit tests

### Commit Guidelines

- Use descriptive commit messages
- Reference issue numbers when applicable
- Keep commits focused on single changes

### Pull Requests

- Ensure CI passes
- Include tests for new features
- Update documentation if needed
- Follow the PR template