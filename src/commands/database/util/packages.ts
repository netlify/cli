import { log } from '../../../utils/command-helpers.js'
import BaseCommand from '../../base-command.js'
import { spawnAsync } from '../legacy/utils.js'

export type PkgManagerName = 'npm' | 'yarn' | 'pnpm' | 'bun'

export interface PmInfo {
  name: PkgManagerName
  // argv for a "run this external binary" invocation, e.g. ['npx'] for npm or
  // ['yarn', 'dlx'] for yarn. Sourced from `@netlify/build-info`.
  remoteRunArgs: string[]
}

export interface PackageEntry {
  pkg: string
  dev?: boolean
}

// `@netlify/build-info` already detects the project's package manager via a
// multi-signal check (Corepack field, `npm_config_user_agent`, lockfiles). We
// just read that off the command and fall back to npm.
export const getPackageManager = (command: BaseCommand): PmInfo => {
  const detected = command.project.packageManager
  return {
    name: (detected?.name as PkgManagerName | undefined) ?? 'npm',
    remoteRunArgs: detected?.remotePackageCommand ?? ['npx'],
  }
}

// Builds the argv for adding one or more packages in a single install call.
// `quiet` injects per-manager flags that reduce output to warnings + errors.
export const buildAddArgs = (name: PkgManagerName, pkgs: string[], dev: boolean, quiet: boolean): string[] => {
  switch (name) {
    case 'yarn':
      return ['add', ...(quiet ? ['--silent'] : []), ...(dev ? ['-D'] : []), ...pkgs]
    case 'pnpm':
      return ['add', ...(quiet ? ['--reporter=append-only', '--loglevel=warn'] : []), ...(dev ? ['-D'] : []), ...pkgs]
    case 'bun':
      return ['add', ...(quiet ? ['--silent'] : []), ...(dev ? ['--dev'] : []), ...pkgs]
    default:
      return [
        'install',
        ...(quiet ? ['--loglevel=warn', '--no-audit', '--no-fund', '--no-progress'] : []),
        ...(dev ? ['--save-dev'] : []),
        ...pkgs,
      ]
  }
}

// Produces a user-facing install command string (without quiet flags), safe to
// show as a suggestion in the terminal.
export const installCommand = (name: PkgManagerName, pkg: string, dev = false): string =>
  `${name} ${buildAddArgs(name, [pkg], dev, false).join(' ')}`

// Shells out to the detected package manager to add one or more packages,
// with quiet flags so only warnings and errors surface. Prod-only and dev-only
// packages run as separate calls (most managers don't let them mix), but the
// whole batch is wrapped in a single pair of 📦 delimiters so callers only see
// one "install" block in their output.
export const installPackages = async (pm: PmInfo, projectRoot: string, entries: PackageEntry[]): Promise<void> => {
  if (entries.length === 0) return

  const prod = entries.filter((entry) => !entry.dev).map((entry) => entry.pkg)
  const dev = entries.filter((entry) => entry.dev).map((entry) => entry.pkg)

  log('')
  log('----- 📦 ⏳ -----')

  try {
    if (prod.length > 0) {
      await spawnAsync(pm.name, buildAddArgs(pm.name, prod, false, true), {
        stdio: 'inherit',
        shell: true,
        cwd: projectRoot,
      })
    }
    if (dev.length > 0) {
      await spawnAsync(pm.name, buildAddArgs(pm.name, dev, true, true), {
        stdio: 'inherit',
        shell: true,
        cwd: projectRoot,
      })
    }
  } catch (error) {
    log('----- 📦 ❌ -----')

    throw error
  }

  log('----- 📦 ✅ -----')
  log('')
  log('')
}
