export interface APIError extends Error {
  status: number
}

export const isErrnoException = (value: unknown): value is NodeJS.ErrnoException =>
  value instanceof Error && Object.hasOwn(value, 'code')

// `@netlify/api` doesn't export its `HTTPError` class, so match it structurally
export const isAPIError = (value: unknown): value is APIError =>
  value instanceof Error && 'status' in value && typeof value.status === 'number'

export const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export const formatAPIError = (error: unknown): string =>
  isAPIError(error) ? `${error.status.toString()}: ${error.message}` : getErrorMessage(error)

// `@netlify/config` tags intentional user-input errors (malformed netlify.toml, invalid redirects, etc.) this way
// but doesn't export its `isUserError` helper. See `@netlify/config/lib/error.js`.
export const isNetlifyConfigUserError = (
  value: unknown,
): value is Error & { customErrorInfo: { type: 'resolveConfig' } } =>
  value instanceof Error &&
  'customErrorInfo' in value &&
  typeof value.customErrorInfo === 'object' &&
  value.customErrorInfo !== null &&
  'type' in value.customErrorInfo &&
  value.customErrorInfo.type === 'resolveConfig'
