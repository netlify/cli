import { readFile } from 'fs/promises'
import path from 'path'

import dotenv from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

interface DotEnvFile {
  file?: string
  env?: NodeJS.ProcessEnv
  warning?: string
}

interface LoadDotEnvFilesOptions {
  envFiles?: string[]
  projectDir: string
}

interface TryLoadDotEnvFilesOptions {
  dotenvFiles?: string[]
  projectDir: string
}

export const loadDotEnvFiles = async function ({ envFiles, projectDir }: LoadDotEnvFilesOptions) {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  response
    .filter((el): el is DotEnvFile & { warning: string } => Boolean(el.warning))
    .forEach((el) => {
      warn(el.warning)
    })

  return response.filter((el) => el.file && el.env)
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

export const tryLoadDotEnvFiles = async ({
  dotenvFiles = defaultEnvFiles,
  projectDir,
}: TryLoadDotEnvFilesOptions): Promise<DotEnvFile[]> => {
  const results = await Promise.all(
    dotenvFiles.map(async (file): Promise<DotEnvFile | undefined> => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        return {
          warning: `Failed reading env variables from file: ${filepath}: ${String(error)}`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter((result): result is DotEnvFile => Boolean(result)).reverse()
}
