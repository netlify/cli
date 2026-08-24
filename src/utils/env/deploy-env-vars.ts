import { InvalidArgumentError } from 'commander'

export interface DeployEnvironmentVariable {
  key: string
  value: string
  is_secret: boolean
  scopes: ['functions']
}

const MAX_KEY_LENGTH = 255
const VALID_KEY_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/

const RESERVED_KEY_NAMES = new Set([
  // AWS-specific env vars
  'AWS_REGION',
  'AWS_EXECUTION_ENV',
  'AWS_LAMBDA_FUNCTION_NAME',
  'AWS_LAMBDA_FUNCTION_MEMORY_SIZE',
  'AWS_LAMBDA_FUNCTION_VERSION',
  'AWS_LAMBDA_LOG_GROUP_NAME',
  'AWS_LAMBDA_LOG_STREAM_NAME',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_LAMBDA_RUNTIME_API',
  'NETLIFY',
  'BUILD_ID',
  'CONTEXT',
  'REPOSITORY_URL',
  'BRANCH',
  'HEAD',
  'COMMIT_REF',
  'CACHED_COMMIT_REF',
  'PULL_REQUEST',
  'REVIEW_ID',
  'URL',
  'DEPLOY_URL',
  'DEPLOY_PRIME_URL',
  'DEPLOY_ID',
  'SITE_NAME',
  'SITE_ID',
  'NETLIFY_IMAGES_CDN_DOMAIN',
  'INCOMING_HOOK_TITLE',
  'INCOMING_HOOK_URL',
  'INCOMING_HOOK_BODY',
])

const validateKey = (key: string): void => {
  if (key.length > MAX_KEY_LENGTH) {
    throw new InvalidArgumentError(`Key names should be ${MAX_KEY_LENGTH.toString()} characters or less.`)
  }
  if (!VALID_KEY_NAME.test(key)) {
    throw new InvalidArgumentError(
      'Key names must start with a letter and can only consist of alphanumeric characters and underscores',
    )
  }
  if (RESERVED_KEY_NAMES.has(key.toUpperCase())) {
    throw new InvalidArgumentError(`${key} is a reserved key name`)
  }
}

export type DeployEnvVarFlag = '--env' | '--secret-env'

/**
 * Builds a Commander argument parser that accumulates `KEY=VALUE` arguments into a list of
 * deploy-scoped environment variables. This lets the flag be repeated.
 *
 * Throws `InvalidArgumentError` if the argument is not in `KEY=VALUE` format, or if the key would
 * be rejected by Envelope.
 */
// (TODO(ndhoule): Ideally we'd let the API call perform this validation and return an
// error, but it currently does not.)
export const parseDeployEnvVar =
  (flag: DeployEnvVarFlag) =>
  (arg: string, previous: DeployEnvironmentVariable[] = []): DeployEnvironmentVariable[] => {
    const separatorIndex = arg.indexOf('=')
    if (separatorIndex === -1) {
      throw new InvalidArgumentError(`Invalid ${flag} value "${arg}". Expected KEY=VALUE.`)
    }

    const key = arg.slice(0, separatorIndex)
    if (key === '') {
      throw new InvalidArgumentError(`Invalid ${flag} value "${arg}". Expected KEY=VALUE.`)
    }
    validateKey(key)

    return [
      ...previous,
      {
        key,
        value: arg.slice(separatorIndex + 1),
        is_secret: flag === '--secret-env',
        // Deploy-scoped variables only take effect in the functions scope.
        scopes: ['functions'],
      },
    ]
  }

/**
 * Combines the variables collected by `--env` and `--secret-env` into the single list the API
 * expects.
 */
export const mergeDeployEnvVars = (
  env: DeployEnvironmentVariable[] = [],
  secretEnv: DeployEnvironmentVariable[] = [],
): DeployEnvironmentVariable[] => [...env, ...secretEnv]

/**
 * Returns the first key that appears more than once, or `undefined` if all keys are unique.
 *
 * The API rejects duplicate keys, and a single flag's parser cannot see the other flag's values,
 * so callers must check the merged list.
 */
export const findDuplicateKey = (variables: DeployEnvironmentVariable[]): string | undefined => {
  const seen = new Set<string>()

  for (const { key } of variables) {
    if (seen.has(key)) {
      return key
    }
    seen.add(key)
  }

  return undefined
}
