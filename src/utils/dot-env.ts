import { readFile } from 'fs/promises'
import path from 'path'

import dotenv from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

export interface DotEnvResult {
  file?: string
  env?: dotenv.DotenvParseOutput
  warning?: string
}

export const loadDotEnvFiles = async function ({ envFiles, projectDir }: { envFiles?: string[]; projectDir: string }) {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  const filesWithWarning = response.filter((el): el is { warning: string } => Boolean(el.warning))
  filesWithWarning.forEach((el) => {
    warn(el.warning)
  })

  return response.filter((el): el is { file: string; env: dotenv.DotenvParseOutput } => Boolean(el.file && el.env))
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

export const tryLoadDotEnvFiles = async ({
  dotenvFiles,
  projectDir,
}: {
  dotenvFiles?: string[]
  projectDir: string
}): Promise<DotEnvResult[]> => {
  const filesToLoad = dotenvFiles && dotenvFiles.length !== 0 ? dotenvFiles : defaultEnvFiles
  const results = await Promise.all(
    filesToLoad.map(async (file): Promise<DotEnvResult | undefined> => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        return {
          warning: `Failed reading env variables from file: ${filepath}: ${
            error instanceof Error ? error.message : error
          }`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter((el): el is DotEnvResult => Boolean(el)).reverse()
}
