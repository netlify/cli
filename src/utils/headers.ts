import { type Header, parseAllHeaders } from '@netlify/headers-parser'

import { NETLIFYDEVERR, type NormalizedCachedConfigConfig, log } from './command-helpers.js'

/**
 * Get the matching headers for `path` given a set of `rules`.
 */
export const headersForPath = function (headers: Header[], path: string) {
  const matchingHeaders = headers.filter(({ forRegExp }) => forRegExp.test(path)).map(getHeaderValues)
  const headersRules = Object.assign({}, ...matchingHeaders)
  return headersRules
}

const getHeaderValues = function ({ values }: Header) {
  return values
}

export const parseHeaders = async function ({
  config,
  configPath,
  headersFiles,
}: {
  config: NormalizedCachedConfigConfig
  configPath?: string | undefined
  headersFiles?: string[] | undefined
}): Promise<Header[]> {
  const { errors, headers } = await parseAllHeaders({
    headersFiles,
    netlifyConfigPath: configPath,
    minimal: false,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- XXX(serhalp): fixed in stacked PR.
    configHeaders: config.headers ?? [],
  })
  handleHeadersErrors(errors)
  // TODO(serhalp): Make `parseAllHeaders()` smart enough to conditionally return a refined type based on `minimal`
  return headers as Header[]
}

const handleHeadersErrors = function (errors: Error[]) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Headers syntax errors:\n${errorMessage}`)
}

const getErrorMessage = function ({ message }: Error): string {
  return message
}

export const NFFunctionName = 'x-nf-function-name'
export const NFFunctionRoute = 'x-nf-function-route'
export const NFRequestID = 'x-nf-request-id'
