import { InvalidArgumentError } from 'commander'
import { describe, expect, test } from 'vitest'

import { findDuplicateKey, mergeDeployEnvVars, parseDeployEnvVar } from '../../../../src/utils/env/deploy-env-vars.js'

const parseEnv = parseDeployEnvVar('--env')
const parseSecretEnv = parseDeployEnvVar('--secret-env')

describe('parseDeployEnvVar', () => {
  test('parses KEY=VALUE into the shape the API expects', () => {
    expect(parseEnv('NODE_ENV=production')).toEqual([
      { key: 'NODE_ENV', value: 'production', is_secret: false, scopes: ['functions'] },
    ])
  })

  test('marks values from --secret-env as secret', () => {
    expect(parseSecretEnv('DATABASE_PASSWORD=hunter2')).toEqual([
      { key: 'DATABASE_PASSWORD', value: 'hunter2', is_secret: true, scopes: ['functions'] },
    ])
  })

  test('preserves `=` inside variable values', () => {
    expect(parseEnv('API_URL=https://example.com/?a=b&c=d')).toEqual([
      { key: 'API_URL', value: 'https://example.com/?a=b&c=d', is_secret: false, scopes: ['functions'] },
    ])
  })

  test('accepts an empty value', () => {
    expect(parseEnv('EMPTY=')).toEqual([{ key: 'EMPTY', value: '', is_secret: false, scopes: ['functions'] }])
  })

  test('accumulates repeated flags', () => {
    const first = parseEnv('A=1')
    const second = parseEnv('B=2', first)

    expect(second).toEqual([
      { key: 'A', value: '1', is_secret: false, scopes: ['functions'] },
      { key: 'B', value: '2', is_secret: false, scopes: ['functions'] },
    ])
  })

  test.each([
    ['no separator', 'NODE_ENV'],
    ['empty key', '=production'],
  ])('rejects a value with %s', (_, arg) => {
    expect(() => parseEnv(arg)).toThrow(InvalidArgumentError)
    expect(() => parseEnv(arg)).toThrow(`Invalid --env value "${arg}". Expected KEY=VALUE.`)
  })

  test.each([
    ['a reserved key', 'SITE_ID=abc'],
    ['a reserved key in lowercase', 'site_id=abc'],
  ])('rejects %s', (_, arg) => {
    expect(() => parseEnv(arg)).toThrow(/is a reserved key name/)
  })

  test.each([
    ['starting with a digit', '2FA=on'],
    ['containing a hyphen', 'MY-VAR=1'],
    ['containing a dot', 'MY.VAR=1'],
  ])('rejects a key %s', (_, arg) => {
    expect(() => parseEnv(arg)).toThrow(/must start with a letter/)
  })

  test('rejects a key longer than 255 characters', () => {
    expect(() => parseEnv(`${'A'.repeat(256)}=1`)).toThrow('Key names should be 255 characters or less.')
    expect(parseEnv(`${'A'.repeat(255)}=1`)).toHaveLength(1)
  })
})

describe('mergeDeployEnvVars', () => {
  test('returns an empty list when neither flag was used', () => {
    expect(mergeDeployEnvVars()).toEqual([])
  })

  test('concatenates plain and secret variables', () => {
    expect(mergeDeployEnvVars(parseEnv('A=1'), parseSecretEnv('B=2'))).toEqual([
      { key: 'A', value: '1', is_secret: false, scopes: ['functions'] },
      { key: 'B', value: '2', is_secret: true, scopes: ['functions'] },
    ])
  })
})

describe('findDuplicateKey', () => {
  test('returns undefined when all keys are unique', () => {
    expect(findDuplicateKey(mergeDeployEnvVars(parseEnv('A=1'), parseSecretEnv('B=2')))).toBeUndefined()
  })

  test('finds a key repeated across --env and --secret-env', () => {
    expect(findDuplicateKey(mergeDeployEnvVars(parseEnv('A=1'), parseSecretEnv('A=2')))).toBe('A')
  })

  test('finds a key repeated within a single flag', () => {
    expect(findDuplicateKey(parseEnv('A=2', parseEnv('A=1')))).toBe('A')
  })
})
