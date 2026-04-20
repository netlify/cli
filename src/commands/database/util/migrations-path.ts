import { join } from 'path'

import BaseCommand from '../../base-command.js'

// Default on-disk location for migration files, relative to the project root.
// Can be overridden by setting `db.migrations.path` in `netlify.toml`.
export const DEFAULT_MIGRATIONS_PATH = 'netlify/database/migrations'

// Resolves the absolute path of the project's migrations directory. Prefers
// the `db.migrations.path` override from `netlify.toml` when present; falls
// back to `<project-root>/netlify/database/migrations`.
export const resolveMigrationsDirectory = (command: BaseCommand): string => {
  const configuredPath = command.netlify.config.db?.migrations?.path
  if (configuredPath) {
    return configuredPath
  }

  const projectRoot = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!projectRoot) {
    throw new Error('Could not determine the project root directory.')
  }

  return join(projectRoot, DEFAULT_MIGRATIONS_PATH)
}
