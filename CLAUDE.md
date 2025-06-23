# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Development
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode development
./bin/run.js [command] # Run CLI locally during development

# Testing
npm test              # Run all tests (unit → integration → e2e)
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only

# Code Quality
npm run lint          # ESLint with TypeScript checking
npm run format        # Prettier formatting
```

## Architecture Overview

### Command System
- **Base Pattern**: All commands extend `BaseCommand` from `src/commands/base-command.ts`
- **Structure**: Each command has `index.ts` (definition) + `<command>.ts` (implementation)
- **Registration**: Commands registered in `src/commands/main.ts`
- **Framework**: Built on Commander.js with custom help formatting

### Key Architectural Constraints
1. **ESM Module**: Pure ES modules, no CommonJS
2. **Working Directory**: Never use `process.cwd()` - use `command.workingDir` 
3. **Chalk Usage**: Import from safe helper, not directly
4. **TypeScript**: Strict checking enabled, compile to `dist/`

### Configuration System
- **Netlify Config**: Uses `@netlify/config` for `netlify.toml` resolution
- **Contexts**: Supports production, dev, deploy-preview contexts
- **Workspace-aware**: Detects and handles JavaScript monorepos (npm/yarn/pnpm)
- **Authentication**: OAuth browser flow with token management

### Directory Structure
```
src/
├── commands/     # CLI commands (api, build, deploy, dev, etc.)
├── lib/         # Core functionality (functions, edge-functions, build)
├── utils/       # Utilities and helpers
└── recipes/     # Code generation recipes
```

## Development Patterns

### Adding New Commands
1. Create `src/commands/<name>/` directory
2. Implement command class extending `BaseCommand`
3. Export from `index.ts` with proper types
4. Register in `src/commands/main.ts`
5. Add tests in `tests/integration/commands/<name>/`

### Testing Strategy
- **Unit**: Fast, isolated logic tests
- **Integration**: CLI command testing with fixtures in `tests/integration/__fixtures__/`
- **E2E**: Full end-to-end scenarios
- **Live Tests**: Some create actual Netlify sites (use `NETLIFY_TEST_DISABLE_LIVE=true` to skip)

### Monorepo Support
Commands automatically detect workspace context and filter packages. Use `base-command.ts` methods for workspace handling rather than implementing custom logic.

## Special Considerations

### Error Handling
All commands include telemetry and comprehensive error reporting. Use `BaseCommand` error handling patterns rather than raw throws.

### Environment Variables
- `DEBUG_TESTS=true` - Show subprocess output in tests
- `NETLIFY_TEST_DISABLE_LIVE=true` - Skip tests requiring live Netlify sites
- Various `NETLIFY_*` vars for authentication and API endpoints

### Code Quality
ESLint enforces strict TypeScript checking with custom rules preventing common issues like incorrect working directory usage. Always run linting before commits.