import { once } from 'events'
import fs from 'fs'
import os from 'os'
import process from 'process'
import { format, inspect } from 'util'

import chokidar from 'chokidar'
import type { Option } from 'commander'
import decache from 'decache'
import WSL from 'is-wsl'
import debounce from 'lodash/debounce.js'
import type { NetlifyAPI } from 'netlify'
import terminalLink from 'terminal-link'

import { clearSpinner, startSpinner } from '../lib/spinner.js'

import getGlobalConfigStore from './get-global-config-store.js'
import getCLIPackageJson from './get-cli-package-json.js'
import { reportError } from './telemetry/report-error.js'
import type { TokenLocation } from './types.js'
import type { CachedConfig } from '../lib/build.js'

/** The parsed process argv without the binary only arguments and flags */
const argv = process.argv.slice(2)

/**
 * ansis instance for CLI that can be initialized with no colors mode
 * needed for json outputs where we don't want to have colors
 * Strangely, mutating `process.env` seems to be the recommended approach.
 * TODO(serhalp) Move this into `bin/run.js` maybe?
 */
if (argv.includes('--json')) process.env.NO_COLOR = '1'
const { default: ansisModule } = await import('ansis')
export const ansis = ansisModule

/**
 * Adds the filler to the start of the string
 */
export const padLeft = (str: string, count: number, filler = ' ') => str.padStart(str.length + count, filler)

const platform = WSL ? 'wsl' : os.platform()
const arch = os.arch() === 'ia32' ? 'x86' : os.arch()

const { name, version: packageVersion } = await getCLIPackageJson()

export const version = packageVersion
export const USER_AGENT = `${name}/${version} ${platform}-${arch} node-${process.version}`

/** A list of base command flags that needs to be sorted down on documentation and on help pages */
const BASE_FLAGS = new Set(['--debug', '--http-proxy', '--http-proxy-certificate-filename'])

export const NETLIFY_CYAN = ansis.rgb(40, 180, 170)

export const NETLIFYDEV = `${ansis.greenBright('◈')} ${NETLIFY_CYAN('Netlify Dev')} ${ansis.greenBright('◈')}`
export const NETLIFYDEVLOG = ansis.greenBright('◈')
export const NETLIFYDEVWARN = ansis.yellowBright('◈')
export const NETLIFYDEVERR = ansis.redBright('◈')

export const BANG = process.platform === 'win32' ? '»' : '›'

/**
 * Sorts two options so that the base flags are at the bottom of the list
 * @example
 * options.sort(compareOptions)
 */
export const compareOptions = (optionA: Option, optionB: Option): number => {
  const longOptionA = optionA.long ?? ''
  const longOptionB = optionB.long ?? ''
  // base flags should be always at the bottom
  // FIXME(serhalp) This logic can't be right? Look at it... This must only happen to work.
  if (BASE_FLAGS.has(longOptionA) || BASE_FLAGS.has(longOptionB)) {
    return -1
  }
  return longOptionA.localeCompare(longOptionB)
}

// Poll Token timeout 5 Minutes
const TOKEN_TIMEOUT = 3e5

export const pollForToken = async ({
  api,
  ticket,
}: {
  api: NetlifyAPI
  ticket: {
    id?: string
    client_id?: string
    authorized?: boolean
    created_at?: string
  }
}) => {
  const spinner = startSpinner({ text: 'Waiting for authorization...' })
  try {
    const accessToken = await api.getAccessToken(ticket, {
      timeout: TOKEN_TIMEOUT,
    })
    if (!accessToken) {
      return logAndThrowError('Could not retrieve access token')
    }
    return accessToken
  } catch (error_) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    if (error_.name === 'TimeoutError') {
      return logAndThrowError(
        `Timed out waiting for authorization. If you do not have a ${ansis.bold.greenBright(
          'Netlify',
        )} account, please create one at ${ansis.magenta(
          'https://app.netlify.com/signup',
        )}, then run ${ansis.cyanBright('netlify login')} again.`,
      )
    } else {
      return logAndThrowError(error_)
    }
  } finally {
    clearSpinner({ spinner })
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
  const globalConfig = await getGlobalConfigStore()
  const userId = globalConfig.get('userId')
  const tokenFromConfig = globalConfig.get(`users.${userId}.auth.token`)
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
  const bang = ansis.yellow(BANG)
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

  const bang = ansis.red(BANG)
  if (process.env.DEBUG) {
    process.stderr.write(` ${bang}   Warning: ${err.stack?.split('\n').join(`\n ${bang}   `)}\n`)
  } else {
    process.stderr.write(` ${bang}   ${ansis.red(`${err.name}:`)} ${err.message}\n`)
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

const DEBOUNCE_WAIT = 100

interface WatchDebouncedOptions {
  depth?: number
  ignored?: (string | RegExp)[]
  onAdd?: (paths: string[]) => void
  onChange?: (paths: string[]) => void
  onUnlink?: (paths: string[]) => void
}

/**
 * Adds a file watcher to a path or set of paths and debounces the events.
 */
export const watchDebounced = async (
  target: string | string[],
  { depth, ignored = [], onAdd = noOp, onChange = noOp, onUnlink = noOp }: WatchDebouncedOptions,
) => {
  const baseIgnores = [/\/(node_modules|.git)\//]
  const watcher = chokidar.watch(target, {
    depth,
    ignored: [...baseIgnores, ...ignored],
    ignoreInitial: true,
  })

  await once(watcher, 'ready')

  let onChangeQueue: string[] = []
  let onAddQueue: string[] = []
  let onUnlinkQueue: string[] = []

  const debouncedOnChange = debounce(() => {
    onChange(onChangeQueue)
    onChangeQueue = []
  }, DEBOUNCE_WAIT)
  const debouncedOnAdd = debounce(() => {
    onAdd(onAddQueue)
    onAddQueue = []
  }, DEBOUNCE_WAIT)
  const debouncedOnUnlink = debounce(() => {
    onUnlink(onUnlinkQueue)
    onUnlinkQueue = []
  }, DEBOUNCE_WAIT)

  watcher
    .on('change', (path) => {
      // @ts-expect-error
      decache(path)
      onChangeQueue.push(path)
      debouncedOnChange()
    })
    .on('unlink', (path) => {
      // @ts-expect-error
      decache(path)
      onUnlinkQueue.push(path)
      debouncedOnUnlink()
    })
    .on('add', (path) => {
      // @ts-expect-error
      decache(path)
      onAddQueue.push(path)
      debouncedOnAdd()
    })

  return watcher
}

export const getTerminalLink = (text: string, url: string): string =>
  terminalLink(text, url, { fallback: () => `${text} (${url})` })

export const isNodeError = (err: unknown): err is NodeJS.ErrnoException => err instanceof Error

export const nonNullable = <T>(value: T): value is NonNullable<T> => value !== null && value !== undefined

export const noOp = () => {
  // no-op
}

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

export const checkFileForLine = (filename: string, line: string): boolean => {
  let fileContent = ''
  try {
    fileContent = fs.readFileSync(filename, 'utf8')
  } catch (error_) {
    return logAndThrowError(error_)
  }
  return fileContent.includes(line)
}

export const TABTAB_CONFIG_LINE = '[[ -f ~/.config/tabtab/__tabtab.zsh ]] && . ~/.config/tabtab/__tabtab.zsh || true'
export const AUTOLOAD_COMPINIT = 'autoload -U compinit; compinit'
