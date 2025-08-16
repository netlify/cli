# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

The Netlify CLI is a command-line interface for interacting with Netlify's platform, written in TypeScript and built on Node.js. It provides functionality for site deployment, local development, functions management, and more.

## Development Commands

**Build and Development:**
- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm run dev` - Watch mode compilation with TypeScript
- `npm run clean` - Remove dist/ directory
- `npm start` - Run the CLI using the built code

**Testing:**
- `npm test` - Run all tests (unit + integration + e2e)
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:init` - Initialize test dependencies
- To run a single test file: `npx vitest tests/unit/path/to/test.test.ts`

**Code Quality:**
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix auto-fixable linting issues
- `npm run typecheck` - Run TypeScript compiler checks
- `npm run typecheck:watch` - Watch mode for type checking
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

**Local Development Setup:**
1. `npm link` - Link the local CLI for testing
2. Use `netlify` command to test local changes

## Architecture

**Command Structure:**
- All commands extend `BaseCommand` (`src/commands/base-command.ts`)
- Commands are organized in `src/commands/` with subcommands in subdirectories
- Command registration happens in `src/commands/main.ts`
- Each command follows the pattern: `src/commands/[command]/[command].ts`

**Key Directories:**
- `src/commands/` - CLI command implementations
- `src/lib/` - Core library functionality (API, configuration, etc.)
- `src/utils/` - Utility functions and helpers
- `src/recipes/` - Automated setup recipes for frameworks
- `tests/unit/` - Unit tests
- `tests/integration/` - Integration tests
- `e2e/` - End-to-end tests
- `functions-templates/` - Templates for creating functions

**Configuration Management:**
- Uses `@netlify/config` for resolving netlify.toml files
- Configuration resolution happens in `BaseCommand.getConfig()`
- Supports workspace/monorepo configurations
- State management through `CLIState` class

**Function Handling:**
- Functions are managed through `src/lib/functions/`
- Supports multiple runtimes: JavaScript, TypeScript, Go, Rust
- Local function serving via `src/lib/functions/server.ts`
- Function templates in `functions-templates/`

**Development Server:**
- Local development server in `src/commands/dev/`
- Edge functions support via `src/lib/edge-functions/`
- Proxy functionality for API calls and redirects
- Live reloading and hot module replacement

**API Integration:**
- Uses `@netlify/api` for Netlify API communication
- Authentication handling in `BaseCommand.authenticate()`
- Site information and deployment management

## Testing Architecture

**Test Framework:** Vitest with custom configurations
- Unit tests: Fast, isolated testing of individual modules
- Integration tests: Test command interactions with fixtures
- E2E tests: Full CLI command testing with live sites

**Test Utilities:**
- `tests/integration/utils/` contains testing helpers
- Mock API responses in `tests/integration/utils/mock-api.ts`
- Site builder utilities for test setup
- Fixture projects in `tests/integration/__fixtures__/`

**Running Specific Tests:**
- Unit: `npx vitest tests/unit/specific-test.test.ts`
- Integration: `npx vitest tests/integration/specific-area/`
- Coverage: `npm run test` generates coverage reports

## Key Dependencies

- `commander` - CLI framework
- `@netlify/*` packages - Core Netlify functionality
- `inquirer` - Interactive prompts
- `chalk` - Terminal styling
- `execa` - Process execution
- `fastify` - Local development server
- `chokidar` - File watching

## Architecture Visualization Command

**New Feature:** The CLI now includes a comprehensive architecture visualization command that shows how Netlify's primitives work together.

### Basic Usage
```bash
netlify architecture                    # Show static architecture
netlify arch                           # Short alias
netlify architecture --include-metrics # Include live performance data
netlify architecture --format json    # JSON output for scripting
```

### Advanced Options
```bash
netlify architecture --scope functions     # Focus on functions only
netlify architecture --scope edge         # Focus on edge functions
netlify architecture --time-range 7d      # Show 7 days of metrics
netlify architecture --branch staging     # Analyze specific branch
```

### Integration Points
- **Post-Deploy**: Automatically shows architecture summary after successful deployments
- **Dev Server**: Shows local architecture emulation on `netlify dev` startup
- **Observability**: Integrates with Netlify's new observability APIs for live metrics
- **Error Handling**: Graceful fallbacks when live data unavailable

### Architecture Components
The command analyzes and displays:
- **Edge Network**: Domain, SSL, CDN, caching performance
- **Edge Functions**: Both framework-generated and custom
- **Serverless Functions**: Performance metrics, error rates, types
- **Framework Integration**: Auto-detected frameworks and features
- **Data Layer**: Blob store, databases, external API usage
- **Security**: WAF, firewall, rate limiting status

### File Structure
```
src/commands/architecture/
├── architecture.ts           # Main command implementation
├── architecture-analyzer.ts  # Static analysis of local code
├── architecture-renderer.ts  # ASCII/JSON output formatting
├── observability-client.ts   # Live metrics API integration
├── post-deploy-integration.ts# Deploy/dev server integration
├── error-handling.ts         # Comprehensive error handling
├── example-output.md         # Usage examples
└── index.ts                  # Public exports
```

## Node.js Requirements

- Node.js >=20.12.2 required
- Uses ES modules (type: "module" in package.json)
- TypeScript compilation target: ES2022

## Workspace Support

The CLI supports monorepos and workspaces:
- Detects workspace configurations automatically
- `--filter` flag to target specific packages
- Workspace root detection and package selection
- Configuration file resolution per workspace

## Build System

- TypeScript compilation with `tsconfig.build.json`
- Output to `dist/` directory
- Source maps enabled for debugging
- Module resolution supports both ES modules and CommonJS dependencies