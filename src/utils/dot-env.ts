import { readFile } from 'fs/promises'
import path from 'path'

import dotenv, { type DotenvParseOutput } from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

interface LoadedDotEnvFile {
  file: string
  env: DotenvParseOutput
}

export const loadDotEnvFiles = async function ({
  envFiles,
  projectDir,
}: {
  envFiles?: string[]
  projectDir?: string
}): Promise<LoadedDotEnvFile[]> {
  const loadedDotEnvFiles = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  loadedDotEnvFiles
    .filter((el): el is { warning: string } => 'warning' in el)
    .forEach((el) => {
      warn(el.warning)
    })

  return loadedDotEnvFiles.filter((el): el is LoadedDotEnvFile => 'file' in el && 'env' in el)
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

export const tryLoadDotEnvFiles = async ({
  dotenvFiles = defaultEnvFiles,
  projectDir,
}: {
  dotenvFiles?: string[]
  projectDir?: string
}): Promise<Array<LoadedDotEnvFile | { warning: string }>> => {
  const results = await Promise.all(
    dotenvFiles.map(async (file) => {
      const filepath = path.resolve(projectDir ?? '', file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        return {
          warning: `Failed reading env variables from file: ${filepath}: ${
            error instanceof Error ? error.message : error?.toString()
          }`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter((result): result is LoadedDotEnvFile => result != null).reverse()
}
