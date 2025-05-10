import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

const ATTRIBUTES_REGEX = /(\S*)="([^\s"]*)"/gim
const BASE_URL = process.env.AI_CONTEXT_BASE_URL || 'https://docs.netlify.com/ai-context'
export const NTL_DEV_MCP_FILE_NAME = 'netlify-development.mdc'
const MINIMUM_CLI_VERSION_HEADER = 'x-cli-min-ver'
export const NETLIFY_PROVIDER = 'netlify'
const PROVIDER_CONTEXT_REGEX = /<providercontext ([^>]*)>(.*)<\/providercontext>/ims
const PROVIDER_CONTEXT_OVERRIDES_REGEX = /<providercontextoverrides([^>]*)>(.*)<\/providercontextoverrides>/ims
const PROVIDER_CONTEXT_OVERRIDES_TAG = 'ProviderContextOverrides'

export interface ContextConfig {
  scope: string
  glob?: string
  shared?: string[]
  endpoint?: string
}

export interface ContextFile {
  key: string
  config: ContextConfig
  content: string
}

export interface ConsumerConfig {
  key: string
  presentedName: string
  consumerProcessCmd?: string
  path: string
  ext: string
  truncationLimit?: number
  contextScopes: Record<string, ContextConfig>
  hideFromCLI?: boolean
  consumerTrigger?: string
}

let contextConsumers: ConsumerConfig[] = []
export const getContextConsumers = async (cliVersion: string) => {
  if (contextConsumers.length > 0) {
    return contextConsumers
  }
  const res = await fetch(`${BASE_URL}/context-consumers`, {
    headers: {
      'user-agent': `NetlifyCLI ${cliVersion}`,
    },
  })
  const data = (await res.json()) as { consumers: ConsumerConfig[] }
  contextConsumers = data?.consumers || []

  return contextConsumers
}

export const downloadFile = async (cliVersion: string, contextConfig: ContextConfig, consumer: ConsumerConfig) => {
  try {
    if (!contextConfig.endpoint) {
      return null
    }

    const url = new URL(contextConfig.endpoint, BASE_URL)
    url.searchParams.set('consumer', consumer.key)

    if (process.env.AI_CONTEXT_BASE_URL) {
      const overridingUrl = new URL(process.env.AI_CONTEXT_BASE_URL)
      url.host = overridingUrl.host
      url.port = overridingUrl.port
      url.protocol = overridingUrl.protocol
    }

    const res = await fetch(url.toString(), {
      headers: {
        'user-agent': `NetlifyCLI ${cliVersion}`,
      },
    })

    if (!res.ok) {
      return null
    }

    const contents = await res.text()
    const minimumCLIVersion = res.headers.get(MINIMUM_CLI_VERSION_HEADER) ?? undefined

    return {
      contents,
      minimumCLIVersion,
    }
  } catch {
    // no-op
  }

  return null
}

interface ParsedContextFile {
  contents: string
  innerContents?: string
  overrides?: {
    contents?: string
    innerContents?: string
  }
  provider?: string
  version?: string
}

/**
 * Parses the `<ProviderContext>` and `<ProviderContextOverrides>` blocks in
 * a context file.
 */
export const parseContextFile = (contents: string) => {
  const result: ParsedContextFile = {
    contents,
  }

  const providerContext = contents.match(PROVIDER_CONTEXT_REGEX)

  if (providerContext) {
    const [, attributes, innerContents] = providerContext

    result.innerContents = innerContents

    for (const [, name, value] of attributes.matchAll(ATTRIBUTES_REGEX)) {
      switch (name.toLowerCase()) {
        case 'provider':
          result.provider = value

          break

        case 'version':
          result.version = value

          break

        default:
          continue
      }
    }
  }

  const contextOverrides = contents.match(PROVIDER_CONTEXT_OVERRIDES_REGEX)

  if (contextOverrides) {
    const [overrideContents, , innerContents] = contextOverrides

    result.overrides = {
      contents: overrideContents,
      innerContents,
    }
  }

  return result
}

/**
 * Takes a context file (a template) and injects a string in an overrides block
 * if one is found. Returns the resulting context file.
 */
export const applyOverrides = (template: string, overrides?: string) => {
  if (!overrides) {
    return template
  }

  return template
    .replace(
      PROVIDER_CONTEXT_OVERRIDES_REGEX,
      `<${PROVIDER_CONTEXT_OVERRIDES_TAG}>${overrides}</${PROVIDER_CONTEXT_OVERRIDES_TAG}>`,
    )
    .trim()
}

/**
 * Reads a file on disk and tries to parse it as a context file.
 */
export const getExistingContext = async (path: string) => {
  try {
    const stats = await fs.stat(path)

    if (!stats.isFile()) {
      throw new Error(`${path} already exists but is not a file. Please remove it or rename it and try again.`)
    }

    const file = await fs.readFile(path, 'utf8')
    const parsedFile = parseContextFile(file)

    return parsedFile
  } catch (error) {
    const exception = error as NodeJS.ErrnoException

    if (exception.code !== 'ENOENT') {
      throw new Error(`Could not open context file at ${path}: ${exception.message}`)
    }

    return null
  }
}

export const writeFile = async (path: string, contents: string) => {
  const directory = dirname(path)

  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path, contents)
}

export const deleteFile = async (path: string) => {
  try {
    // delete file from file system - not just unlinking it
    await fs.rm(path)
  } catch (_) {
    // ignore
  }
}
