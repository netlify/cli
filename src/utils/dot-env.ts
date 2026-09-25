import { readFile } from 'fs/promises'
import path from 'path'

import dotenv from 'dotenv'

import { isFileAsync } from '../lib/fs.js'

import { warn } from './command-helpers.js'

interface DotEnvFile {
  file: string
  env: dotenv.DotenvParseOutput
}

interface DotEnvFileWarning {
  warning: string
}

export const loadDotEnvFiles = async function ({
  envFiles,
  projectDir,
}: {
  envFiles?: string[] | undefined
  projectDir: string
}): Promise<DotEnvFile[]> {
  const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles })

  return response.filter((result): result is DotEnvFile => {
    if ('warning' in result) {
      warn(result.warning)
      return false
    }
    return true
  })
}

// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env']

export const tryLoadDotEnvFiles = async ({
  dotenvFiles = defaultEnvFiles,
  projectDir,
}: {
  dotenvFiles?: string[] | undefined
  projectDir: string
}): Promise<(DotEnvFile | DotEnvFileWarning)[]> => {
  const results = await Promise.all(
    dotenvFiles.map(async (file): Promise<DotEnvFile | DotEnvFileWarning | undefined> => {
      const filepath = path.resolve(projectDir, file)
      try {
        const isFile = await isFileAsync(filepath)
        if (!isFile) {
          return
        }
      } catch (error) {
        return {
          // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
          warning: `Failed reading env variables from file: ${filepath}: ${error.message}`,
        }
      }
      const content = await readFile(filepath, 'utf-8')
      const env = dotenv.parse(content)
      return { file, env }
    }),
  )

  // we return in order of lowest to highest priority
  return results.filter((result) => result !== undefined).reverse()
}
