import { describe, expect, test } from 'vitest'

import { USER_AGENT, getRequestUserAgent, normalizeConfig } from '../../../src/utils/command-helpers.js'
import { createConfig } from '../../integration/utils/config.js'

describe('getRequestUserAgent', () => {
  test('appends only the agent name, without its version or source', () => {
    expect(getRequestUserAgent({ AI_AGENT: 'claude-code@2.1.0' })).toBe(`${USER_AGENT} agent/claude`)
  })

  test('returns the User-Agent unchanged when no agent is detected', () => {
    expect(getRequestUserAgent({})).toBe(USER_AGENT)
  })
})

describe('normalizeConfig', () => {
  test('should remove publish and publishOrigin property if publishOrigin is "default"', () => {
    const config = createConfig({ build: { publish: 'a', publishOrigin: 'default' } })
    const { publish, publishOrigin, ...build } = config.build

    expect(normalizeConfig(config)).toEqual({ ...config, build })
  })

  test('should return same config object if publishOrigin is not "default"', () => {
    const config = createConfig({ build: { publish: 'a', publishOrigin: 'b' } })

    expect(normalizeConfig(config)).toBe(config)
  })
})
