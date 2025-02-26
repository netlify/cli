import { type Header, type MinimalHeader, parseAllHeaders } from '@netlify/headers-parser'

import { NETLIFYDEVERR, log } from './command-helpers.js'

/**
 * Get the matching headers for `path` given a set of `rules`.
 */
export const headersForPath = function (headers: Header[], path: string) {
  const matchingHeaders = headers.filter(({ forRegExp }) => forRegExp.test(path)).map(({ values }) => values)
  const headersRules = { ...matchingHeaders }
  return headersRules
}

export const parseHeaders = async function ({
  config,
  configPath,
  headersFiles,
}: {
  config?:
    | undefined
    | {
        headers?: undefined | MinimalHeader[]
      }
  configPath?: undefined | string
  headersFiles?: undefined | string[]
}): Promise<Header[]> {
  const { errors, headers } = await parseAllHeaders({
    headersFiles,
    netlifyConfigPath: configPath,
    minimal: false,
    configHeaders: config?.headers || [],
  })
  handleHeadersErrors(errors)
  return headers as Header[]
}

const handleHeadersErrors = function (errors: Error[]): void {
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
