// @ts-check
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { createRequire } from 'module'
import { join } from 'path'

import { NETLIFYDEVLOG, NETLIFYDEVWARN, chalk, log } from '../../utils/command-helpers.mjs'

/**
 * The `tsconfig.json` we are going to write to the functions directory.
 * We use a template string instead of JSON.stringify to be able to add comments to the JSON.
 * Comments inside the JSON are accepted by TypeScript and tsconfig.
 */
const TSCONFIG_TMPL = `{
  // "extends": "../tsconfig.json", /** If you want to share configuration enable the extends property (like strict: true) */
  "compilerOptions": {
    "noEmit": true /** This tsconfig.json is only used for type checking and editor support */,
    "module": "ESNext",
    "moduleResolution": "Bundler" /** This is needed to use .ts file extensions as we bundle it */,
    "allowImportingTsExtensions": true /** This allows using .ts file extension instead of the standard .js extension. We allow this for better compatibility with Deno Edge Functions */,
    "checkJs": true /** Enable type checking in JavaScript files as well */,
    "allowJs": true /** Make JavaScript files part of the program as well */
  }
}
`

/**
 * Function that is responsible for validating the typescript configuration for serverless functions.
 * It validates the `tsconfig.json` settings and if they don't comply it will throw an error.
 * @param {object} config
 * @param {string|undefined} config.functionsDir An absolute path to the functions directory
 */
export async function checkTsconfigForV2Api(config) {
  // if no functionsDir is specified or the dir does not exist just return
  if (!config.functionsDir || !existsSync(config.functionsDir)) {
    return
  }

  try {
    const require = createRequire(config.functionsDir)
    require.resolve('@netlify/functions')
  } catch {
    log(
      `${NETLIFYDEVWARN} Please install the ${chalk.dim(
        '@netlify/functions',
      )} package to get a better typed experience!`,
    )
  }
  const tsconfig = join(config.functionsDir, 'tsconfig.json')

  if (existsSync(tsconfig)) {
    return
  }

  await writeFile(tsconfig, TSCONFIG_TMPL, 'utf-8')

  log(
    `${NETLIFYDEVLOG} Successfully created a ${chalk.dim(
      'tsconfig.json',
    )} file in your functions folder for better Editor support!`,
  )
}
