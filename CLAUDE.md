# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run build` - Compiles TypeScript using `tsc --project tsconfig.build.json`
- `npm run dev` - Runs TypeScript compiler in watch mode
- `npm run clean` - Removes the `dist/` directory

### Testing
- `npm test` - Runs the full test suite (unit, integration, and e2e tests)
- `npm run test:unit` - Runs unit tests only with `vitest run tests/unit/`
- `npm run test:integration` - Runs integration tests with `vitest run --retry=3 tests/integration/`
- `npm run test:e2e` - Runs end-to-end tests with `vitest run --config vitest.e2e.config.ts`
- **Single test file**: `npm exec vitest -- run tests/unit/lib/account.test.ts`
- **Single test by name**: `npm exec vitest -- run tests/unit/lib/account.test.ts -t 'test name'`
- **Debug tests**: `DEBUG_TESTS=true npm exec vitest -- run [test-file] -t 'test name'`
- `npm run test:init` - Sets up test dependencies for various fixtures (Hugo, Next.js, monorepo)

### Code Quality
- `npm run lint` - Runs ESLint with cache
- `npm run lint:fix` - Runs ESLint and automatically fixes issues
- `npm run format` - Formats code with Prettier
- `npm run format:check` - Checks code formatting without modifying files
- `npm run typecheck` - Runs TypeScript type checking
- `npm run typecheck:watch` - Runs TypeScript type checking in watch mode

### Running the CLI Locally
- `./bin/run.js [command]` - Runs the CLI locally
- `DEBUG=true ./bin/run.js [command]` - Runs with stack traces enabled for debugging
- `npm run start -- [command]` - Alternative way to run CLI locally

## Architecture

### Core Structure
The Netlify CLI is built with **Commander.js** for CLI interface, **@netlify/js-client** for API interactions, and **TypeScript** with modular architecture. The system uses a registry pattern for managing Functions and Edge Functions, with sophisticated local development server capabilities.

### Key Architectural Patterns

#### Command Architecture
- All commands extend `BaseCommand` class (`src/commands/base-command.ts`) which provides:
  - Consistent config loading and API client setup
  - Site information management and linking
  - Authentication and token handling
  - Analytics and telemetry integration
- Commands follow a modular structure with separate `index.ts` files for exports
- Each command supports both interactive prompts and non-interactive flag-based operation

#### Registry Pattern for Runtime Management
- **FunctionsRegistry** (`src/lib/functions/registry.ts`): Manages Netlify Functions lifecycle
  - Supports multiple runtimes (JavaScript/TypeScript, Go, Rust)
  - Handles hot reloading and file watching
  - Manages function builds and serving
- **EdgeFunctionsRegistry** (`src/lib/edge-functions/registry.ts`): Manages Edge Functions
  - Uses `@netlify/edge-bundler` for Deno-based edge runtime
  - Handles Edge Function deployment and local serving

#### Development Server Architecture (`netlify dev`)
The dev server (`src/commands/dev/dev.ts`) orchestrates multiple subsystems:
- **Proxy Server**: Routes requests between static files, functions, and edge functions
- **Functions Server**: Executes Netlify Functions locally with runtime-specific handlers
- **Edge Functions Proxy**: Serves Edge Functions via Deno runtime
- **Framework Detection**: Auto-detects and integrates with various web frameworks
- **Live Tunneling**: Provides public URLs for local development via Netlify's tunnel service

#### Config System
- Uses `@netlify/config` for configuration resolution and normalization
- Supports `netlify.toml` files with environment-specific overrides
- Integrates with Netlify's build plugins system
- Handles environment variable injection from multiple sources (process, .env files, Netlify site settings)

### Key Libraries and Their Roles

#### Core Infrastructure
- `src/lib/api.ts` - Netlify API client wrapper with authentication
- `src/lib/build.ts` - Build system integration and config caching
- `src/lib/settings.ts` - Project and global settings management
- `src/utils/command-helpers.ts` - Shared utilities for CLI commands (logging, error handling, prompts)

#### Function Runtime System
- `src/lib/functions/runtimes/` - Runtime-specific builders and executors
  - `js/` - JavaScript/TypeScript function handling with `zip-it-and-ship-it`
  - `go/` - Go function compilation and execution
  - `rust/` - Rust function compilation via Cargo
- `src/lib/functions/server.ts` - Local function server with request/response handling

#### Development Tools
- `src/utils/dev.ts` - Development server utilities and environment setup
- `src/utils/proxy-server.ts` - HTTP proxy for routing dev server requests
- `src/utils/detect-server-settings.ts` - Framework detection and port management

#### Deployment System
- `src/utils/deploy/` - Site deployment orchestration
  - File hashing, diffing, and upload optimization
  - Build artifact management and caching
  - Progress tracking and status reporting

### Testing Architecture
- **Unit Tests** (`tests/unit/`): Test individual modules and utilities
- **Integration Tests** (`tests/integration/`): Test full command workflows using fixtures
- **E2E Tests**: Test complete user scenarios with real Netlify API interactions
- **Fixtures** (`tests/integration/__fixtures__/`): Sample projects for testing different frameworks and configurations

### Important Implementation Details

#### Environment Variable Handling
Environment variables are loaded from multiple sources with specific precedence:
1. Process environment
2. `.env` files (multiple variants supported)
3. Netlify site settings (shared, project-specific)
4. Addon-provided variables
5. Build-time configuration

#### Function URL Routing
Functions are accessible via standardized URL patterns:
- `/.netlify/functions/[function-name]` - Standard functions
- `/.netlify/builders/[function-name]` - On-demand builders
- Custom paths supported via function configuration

#### Build Plugin Integration
The CLI integrates with Netlify's build plugin system, allowing plugins to:
- Modify build configuration
- Add custom build steps
- Integrate with the development server
- Provide additional CLI commands

### Development Setup Requirements
- Node.js 20.12.2+ required
- Git LFS must be installed for full test suite
- Some integration tests require Netlify Auth Token (`NETLIFY_AUTH_TOKEN`) or login via `./bin/run.js login`

### Coding Style:
- Never write comments on what the code does, make the code clean and self explanatory instead
