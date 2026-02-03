import { readFile } from 'fs/promises'
import path from 'path'

import dotenv from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

interface DotEnvFileResult {
  file: string
  env: Record<string, string>
}

interface DotEnvWarningResult {
  warning: string
}

type DotEnvResult = DotEnvFileResult | DotEnvWarningResult

/**
 * Loads .env files and returns an array of successfully loaded files and their environment variables.
 */
export const loadDotEnvFiles = async function ({
  envFiles,
  projectDir,
}: {
  envFiles?: string[]
  projectDir: string
}): Promise<DotEnvFileResult[]> {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const filesWithWarning = response.filter((el): el is DotEnvWarningResult => 'warning' in el)
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter((el): el is DotEnvFileResult => 'file' in el && 'env' in el)
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

/**
 * Attempts to load .env files and returns an array of results (file/env or warning).
 */
export const tryLoadDotEnvFiles = async ({
  dotenvFiles = defaultEnvFiles,
  projectDir,
}: {
  dotenvFiles?: string[]
  projectDir: string
}): Promise<DotEnvResult[]> => {
  const results = await Promise.all(
    dotenvFiles.map(async (file): Promise<DotEnvResult | undefined> => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        return {
          warning: `Failed reading env variables from file: ${filepath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter((result): result is DotEnvResult => Boolean(result)).reverse()
}
