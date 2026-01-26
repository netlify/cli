import os from 'os'
import fs from 'fs'
import process from 'process'
import { format, inspect } from 'util'

import type { NetlifyAPI } from '@netlify/api'
import { getAPIToken } from '@netlify/dev-utils'
import { Chalk, type ChalkInstance as ChalkInstancePrimitiveType } from 'chalk'
import type { Option } from 'commander'
import WSL from 'is-wsl'
import terminalLink from 'terminal-link'

import { startSpinner } from '../lib/spinner.js'

import getCLIPackageJson from './get-cli-package-json.js'
import { reportError } from './telemetry/report-error.js'
import type { TokenLocation } from './types.js'
import type { CachedConfig } from '../lib/build.js'

/** The parsed process argv without the binary only arguments and flags */
const argv = process.argv.slice(2)
/**
 * Chalk instance for CLI that can be initialized with no colors mode
 * needed for json outputs where we don't want to have colors
 * @param  {boolean} noColors - disable chalk colors
 * @return {ChalkInstancePrimitiveType} - default or custom chalk instance
 */
const safeChalk = function (noColors: boolean) {
  if (noColors) {
    const colorlessChalk = new Chalk({ level: 0 })
    return colorlessChalk
  }
  return new Chalk()
}

export const chalk = safeChalk(argv.includes('--json'))

export type ChalkInstance = ChalkInstancePrimitiveType

/**
 * Adds the filler to the start of the string
 * @param {string} str
 * @param {number} count
 * @param {string} [filler]
 * @returns {string}
 */
export const padLeft = (str: string, count: number, filler = ' ') => str.padStart(str.length + count, filler)

const platform = WSL ? 'wsl' : os.platform()
const arch = os.arch() === 'ia32' ? 'x86' : os.arch()

const { name, version: packageVersion } = await getCLIPackageJson()

export const version = packageVersion
export const USER_AGENT = `${name}/${version} ${platform}-${arch} node-${process.version}`

/** A list of base command flags that needs to be sorted down on documentation and on help pages */
const BASE_FLAGS = new Set(['--debug', '--http-proxy', '--http-proxy-certificate-filename'])

export const NETLIFY_CYAN = chalk.rgb(40, 180, 170)
export const NETLIFY_CYAN_HEX = '#28b5ac'

// TODO(serhalp) I *think* this "dev" naming is a vestige of the predecessor of the CLI? Rename to avoid
// confusion with `netlify dev` command?
export const NETLIFYDEVLOG = chalk.greenBright('⬥')
export const NETLIFYDEVWARN = chalk.yellowBright('⬥')
export const NETLIFYDEVERR = chalk.redBright('⬥')

export const BANG = process.platform === 'win32' ? '»' : '›'

/**
 * Sorts two options so that the base flags are at the bottom of the list
 * @param {import('commander').Option} optionA
 * @param {import('commander').Option} optionB
 * @returns {number}
 * @example
 * options.sort(sortOptions)
 */
export const sortOptions = (optionA: Option, optionB: Option) => {
  // base flags should be always at the bottom
  if ((optionA.long && BASE_FLAGS.has(optionA.long)) || (optionB.long && BASE_FLAGS.has(optionB.long))) {
    return -1
  }
  return (optionA.long ?? '').localeCompare(optionB.long ?? '')
}

// Poll Token timeout 5 Minutes
const TOKEN_TIMEOUT = 3e5

export const pollForToken = async ({
  api,
  ticket,
}: {
  api: NetlifyAPI
  ticket: { id?: string; client_id?: string; authorized?: boolean; created_at?: string }
}) => {
  const spinner = startSpinner({ text: 'Waiting for authorization...' })
  try {
    const accessToken = await api.getAccessToken(ticket, { timeout: TOKEN_TIMEOUT })
    if (!accessToken) {
      return logAndThrowError('Could not retrieve access token')
    }
    return accessToken
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return logAndThrowError(
        `Timed out waiting for authorization. If you do not have a ${chalk.bold.greenBright(
          'Netlify',
        )} account, please create one at ${chalk.magenta(
          'https://app.netlify.com/signup',
        )}, then run ${chalk.cyanBright('netlify login')} again.`,
      )
    }

    return logAndThrowError(error)
  } finally {
    spinner.stop()
    spinner.clear()
  }
}
/**
 * Get a netlify token
 * @param {string} [tokenFromOptions] optional token from the provided --auth options
 * @returns {Promise<[null|string, 'flag' | 'env' |'config' |'not found']>}
 */

export type TokenTuple = [string | null, TokenLocation]

export const getToken = async (tokenFromOptions?: string): Promise<TokenTuple> => {
  // 1. First honor command flag --auth
  if (tokenFromOptions) {
    return [tokenFromOptions, 'flag']
  }
  // 2. then Check ENV var
  const { NETLIFY_AUTH_TOKEN } = process.env
  if (NETLIFY_AUTH_TOKEN && NETLIFY_AUTH_TOKEN !== 'null') {
    return [NETLIFY_AUTH_TOKEN, 'env']
  }
  // 3. If no env var use global user setting
  const tokenFromConfig = await getAPIToken()
  if (tokenFromConfig) {
    return [tokenFromConfig, 'config']
  }
  return [null, 'not found']
}

// 'api' command uses JSON output by default
// 'functions:invoke' need to return the data from the function as is
const isDefaultJson = () => argv[0] === 'functions:invoke' || (argv[0] === 'api' && !argv.includes('--list'))

/**
 * logs a json message
 */
export const logJson = (message: unknown = '') => {
  if (argv.includes('--json') || isDefaultJson()) {
    process.stdout.write(JSON.stringify(message, null, 2))
  }
}

export const log = (message = '', ...args: string[]) => {
  // If  --silent or --json flag passed disable logger
  if (argv.includes('--json') || argv.includes('--silent') || isDefaultJson()) {
    return
  }
  message = typeof message === 'string' ? message : inspect(message)
  process.stdout.write(`${format(message, ...args)}\n`)
}

export const logPadded = (message = '', ...args: string[]) => {
  log('')
  log(message, ...args)
  log('')
}

/**
 * logs a warning message
 */
export const warn = (message = '') => {
  const bang = chalk.yellow(BANG)
  log(` ${bang}   Warning: ${message}`)
}

const toError = (val: unknown): Error => {
  if (val instanceof Error) return val
  if (typeof val === 'string') return new Error(val)
  const err = new Error(inspect(val))
  err.stack = undefined
  return err
}

export const logAndThrowError = (message: unknown): never => {
  const err = toError(message)
  void reportError(err, { severity: 'error' })
  throw err
}

export const logError = (message: unknown): void => {
  const err = toError(message)

  const bang = chalk.red(BANG)
  if (process.env.DEBUG) {
    process.stderr.write(` ${bang}   Warning: ${err.stack?.split('\n').join(`\n ${bang}   `)}\n`)
  } else {
    process.stderr.write(` ${bang}   ${chalk.red(`${err.name}:`)} ${err.message}\n`)
  }
}

export const exit = (code = 0): never => {
  process.exit(code)
}

/**
 * When `build.publish` is not set by the user, the CLI behavior differs in
 * several ways. It detects it by checking if `build.publish` is `undefined`.
 * However, `@netlify/config` adds a default value to `build.publish`.
 * This removes 'publish' and 'publishOrigin' in this case.
 * TODO(serhalp): Come up with a better name (or kill it?). This sucks but it's descriptive.
 */
export type NormalizedCachedConfigConfig =
  | CachedConfig['config']
  | (Omit<CachedConfig['config'], 'build'> & {
      build: Omit<CachedConfig['config']['build'], 'publish' | 'publishOrigin'>
    })
export const normalizeConfig = (config: CachedConfig['config']): NormalizedCachedConfigConfig => {
  // Unused var here is in order to omit 'publish' from build config
  const { publish, publishOrigin, ...build } = config.build

  return publishOrigin === 'default' ? { ...config, build } : config
}

export const getTerminalLink = (text: string, url: string): string =>
  terminalLink(text, url, { fallback: () => `${text} (${url})` })

export const isNodeError = (err: unknown): err is NodeJS.ErrnoException => err instanceof Error

export const nonNullable = <T>(value: T): value is NonNullable<T> => value !== null && value !== undefined

export interface APIError extends Error {
  status: number
  message: string
}

export class GitHubAPIError extends Error {
  status: string

  constructor(status: string, message: string) {
    super(message)
    this.status = status
    this.name = 'GitHubAPIError'
  }
}

export interface GitHubRepoResponse {
  status?: string
  message?: string
  id?: number
  name?: string
  clone_url?: string
  full_name?: string
  private?: boolean
  default_branch?: string
  errors?: string[]
  is_template?: boolean
}

export const checkFileForLine = (filename: string, line: string) => {
  let filecontent = ''
  try {
    filecontent = fs.readFileSync(filename, 'utf8')
  } catch (error_) {
    return logAndThrowError(error_)
  }
  return !!filecontent.match(line)
}

export const TABTAB_CONFIG_LINE = '[[ -f ~/.config/tabtab/__tabtab.zsh ]] && . ~/.config/tabtab/__tabtab.zsh || true'
export const AUTOLOAD_COMPINIT = 'autoload -U compinit; compinit'

function pkgFromUserAgent(userAgent: string | undefined): string | undefined {
  if (!userAgent) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const [pkgManagerName] = pkgSpec.split('/')
  return pkgManagerName
}

export const netlifyCommand = () => {
  const { npm_command, npm_config_user_agent, npm_lifecycle_event } = process.env

  // Captures both `npx netlify ...` and `npm exec netlify ...`
  if (npm_lifecycle_event === 'npx') {
    return `npx netlify`
  }

  // Captures `pnpm exec netlify ...`
  if (pkgFromUserAgent(npm_config_user_agent) === 'pnpm' && npm_command === 'exec') {
    return `pnpm exec netlify`
  }

  // Captures `pnpx netlify ...`
  if (pkgFromUserAgent(npm_config_user_agent) === 'pnpm' && ['run-script', 'run'].includes(npm_command ?? '')) {
    return `pnpx netlify`
  }

  // Default
  return 'netlify'
}
