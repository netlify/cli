import { resolve } from 'path'

import { Command } from 'commander'
import { type NormalizedPackageJson, readPackage } from 'read-pkg'

import execa from '../../../../../utils/execa.js'
import { fileExistsAsync } from '../../../../fs.js'
import { memoizedBuild } from '../../../memoized-build.js'
import type { BaseBuildResult } from '../../index.js'

export type NetlifyLambdaBuildResult = BaseBuildResult

export const detectNetlifyLambda = async ({ packageJson }: { packageJson: NormalizedPackageJson }) => {
  const { dependencies, devDependencies, scripts } = packageJson
  if (!(dependencies?.['netlify-lambda'] || devDependencies?.['netlify-lambda'])) {
    return false
  }

  const program = new Command()
    .option('-s, --static')
    .option('-c, --config [file]')
    .option('-p, --port [number]')
    .option('-b, --babelrc [file]')
    .option('-t, --timeout [delay]')

  program.allowExcessArguments()

  const matchingScripts = Object.entries(scripts ?? []).filter(([, script]) => /netlify-lambda\s+build/.exec(script))

  for (const [key, script] of matchingScripts) {
    // E.g. ["netlify-lambda", "build", "functions/folder"]
    // these are all valid options for netlify-lambda
    program.parse(script.split(' '))

    // We are not interested in 'netlify-lambda' and 'build' commands
    const functionDirectories = program.args.filter((arg) => !['netlify-lambda', 'build'].includes(arg))
    if (functionDirectories.length === 1) {
      const srcFiles = [resolve(functionDirectories[0])]

      const yarnExists = await fileExistsAsync('yarn.lock')
      const buildCommand = async (): Promise<undefined> => {
        await execa(yarnExists ? 'yarn' : 'npm', ['run', key])
        return
      }

      return {
        build: async ({ cache = {} } = {}): Promise<NetlifyLambdaBuildResult> => {
          await memoizedBuild({ cache, cacheKey: `netlify-lambda-${key}`, command: buildCommand })

          return {
            srcFiles,
          }
        },
        builderName: 'netlify-lambda',

        // Currently used for tests only.
        npmScript: key,
      }
    }
    if (functionDirectories.length === 0) {
      console.warn(`Command 'netlify-lambda build' was detected in script '${key}', but contained no functions folder`)
    } else {
      console.warn(
        `Command 'netlify-lambda build' was detected in script '${key}', but contained 2 or more function folders`,
      )
    }
  }

  return false
}

export default async function detectNetlifyLambdaBuilder() {
  let result
  try {
    result = await readPackage({ normalize: true })
  } catch {
    return false
  }
  return detectNetlifyLambda({ packageJson: result })
}

export type NetlifyLambdaBuilder = Awaited<ReturnType<typeof detectNetlifyLambda>>
