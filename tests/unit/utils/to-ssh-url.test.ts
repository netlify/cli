import { describe, expect, test } from 'vitest'

import { toSshUrl } from '../../../src/utils/init/config-manual.js'

describe('toSshUrl', () => {
  test('returns ssh url unchanged for github', () => {
    const url = 'git@github.com:user/repo.git'
    expect(toSshUrl(url, 'github')).toBe(url)
  })

  test('converts https github url to ssh format', () => {
    const url = 'https://github.com/user/repo.git'
    expect(toSshUrl(url, 'github')).toBe('git@github.com:user/repo.git')
  })

  test('converts https github url without .git extension', () => {
    const url = 'https://github.com/user/repo'
    expect(toSshUrl(url, 'github')).toBe('git@github.com:user/repo.git')
  })

  test('converts https gitlab url to ssh format', () => {
    const url = 'https://gitlab.com/group/subgroup/repo.git'
    expect(toSshUrl(url, 'gitlab')).toBe('git@gitlab.com:group/subgroup/repo.git')
  })

  test('returns https url unchanged for unknown provider', () => {
    const url = 'https://bitbucket.org/user/repo.git'
    expect(toSshUrl(url, 'bitbucket')).toBe(url)
  })

  test('returns https url unchanged for null provider', () => {
    const url = 'https://example.com/user/repo.git'
    expect(toSshUrl(url, null)).toBe(url)
  })

  test('returns invalid url unchanged', () => {
    const url = 'not-a-valid-url'
    expect(toSshUrl(url, 'github')).toBe(url)
  })

  test('handles ssh:// protocol', () => {
    const url = 'ssh://git@github.com/user/repo.git'
    expect(toSshUrl(url, 'github')).toBe(url)
  })
})
