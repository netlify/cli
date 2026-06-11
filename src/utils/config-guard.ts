import { copyFileSync, existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

import { findUp } from 'find-up'

import { getPathInHome } from '../lib/settings.js'

import { BANG, chalk } from './command-helpers.js'

const STATE_RELATIVE_PATH = join('.netlify', 'state.json')

const writeCorruptFileWarning = (filePath: string, backupPath: string, recoveryHint: string) => {
  const bang = chalk.yellow(BANG)
  process.stderr.write(` ${bang}   Warning: ${filePath} contains malformed JSON and will be reset.\n`)
  process.stderr.write(` ${bang}   A backup of the corrupt file was saved to ${backupPath}.\n`)
  process.stderr.write(` ${bang}   Repair and restore the backup, or ${recoveryHint}.\n`)
}

/**
 * Detects an existing-but-unparseable JSON config file before the underlying store
 * silently resets it, copies it to `<file>.corrupt.<mtime>` and warns on stderr.
 * Returns the backup path when a corrupt file was found, `undefined` otherwise.
 */
export const backUpCorruptJsonFile = (filePath: string, recoveryHint: string): string | undefined => {
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch {
    return undefined
  }
  if (raw.trim() === '') {
    return undefined
  }
  try {
    JSON.parse(raw)
    return undefined
  } catch {
    const backupPath = `${filePath}.corrupt.${String(Math.round(statSync(filePath).mtimeMs))}`
    if (!existsSync(backupPath)) {
      copyFileSync(filePath, backupPath)
    }
    writeCorruptFileWarning(filePath, backupPath, recoveryHint)
    return backupPath
  }
}

/**
 * Guards the project-local `.netlify/state.json` (resolved with the same find-up
 * semantics as `LocalState` in `@netlify/dev-utils`).
 */
export const guardLocalStateFile = async (workingDir: string): Promise<string | undefined> => {
  const statePath = (await findUp(STATE_RELATIVE_PATH, { cwd: workingDir })) ?? join(workingDir, STATE_RELATIVE_PATH)
  return backUpCorruptJsonFile(statePath, `delete it and re-run ${chalk.cyanBright('netlify link')}`)
}

/**
 * Guards the global config store file (`~/.config/netlify/config.json` or platform
 * equivalent) which holds auth tokens, before `getGlobalConfigStore` resets it.
 */
export const guardGlobalConfigFile = (): string | undefined =>
  backUpCorruptJsonFile(
    getPathInHome(['config.json']),
    `delete it and re-run ${chalk.cyanBright('netlify login')} to restore your auth tokens`,
  )
