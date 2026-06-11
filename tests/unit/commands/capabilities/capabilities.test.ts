import { describe, expect, test } from 'vitest'

import { createMainCommand } from '../../../../src/commands/main.js'
import { buildCapabilitiesManifest } from '../../../../src/commands/capabilities/capabilities.js'

describe('capabilities', () => {
  test('manifest serializes to valid JSON with the versioned envelope', async () => {
    const manifest = await buildCapabilitiesManifest(createMainCommand())

    const parsed = JSON.parse(JSON.stringify(manifest, null, 2)) as Record<string, unknown>

    expect(parsed.contract_version).toBe('1')
    expect(typeof parsed.cli_version).toBe('string')
    expect(Array.isArray(parsed.commands)).toBe(true)
    expect(Array.isArray(parsed.global_flags)).toBe(true)
    expect(Array.isArray(parsed.env_vars)).toBe(true)
    expect(Array.isArray(parsed.config_files)).toBe(true)
    expect((parsed.exit_codes as Record<string, string>)['0']).toBe('success')
  })

  test('contains env:list and the capabilities command itself', async () => {
    const manifest = await buildCapabilitiesManifest(createMainCommand())
    const names = manifest.commands.map((command) => command.name)

    expect(names).toContain('env:list')
    expect(names).toContain('capabilities')

    const envList = manifest.commands.find((command) => command.name === 'env:list')
    expect(envList?.json_output).toBe(true)
  })

  test('every command object has a name and a flags array', async () => {
    const manifest = await buildCapabilitiesManifest(createMainCommand())

    expect(manifest.commands.length).toBeGreaterThan(40)
    manifest.commands.forEach((command) => {
      expect(typeof command.name).toBe('string')
      expect(command.name.length).toBeGreaterThan(0)
      expect(Array.isArray(command.flags)).toBe(true)
      command.flags.forEach((flag) => {
        expect(typeof flag.name).toBe('string')
        expect(['boolean', 'string']).toContain(flag.type)
      })
      expect(command.mutates).toBeNull()
    })
  })

  test('output is deterministic across two invocations', async () => {
    const first = JSON.stringify(await buildCapabilitiesManifest(createMainCommand()), null, 2)
    const second = JSON.stringify(await buildCapabilitiesManifest(createMainCommand()), null, 2)

    expect(second).toBe(first)
  })

  test('commands and flags are sorted alphabetically', async () => {
    const manifest = await buildCapabilitiesManifest(createMainCommand())

    const names = manifest.commands.map((command) => command.name)
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)))

    manifest.commands.forEach((command) => {
      const flagNames = command.flags.map((flag) => flag.name)
      expect(flagNames).toEqual([...flagNames].sort((left, right) => left.localeCompare(right)))
    })
  })

  test('global flags include --filter, --auth, --debug, and --help', async () => {
    const manifest = await buildCapabilitiesManifest(createMainCommand())
    const globalFlagNames = manifest.global_flags.map((flag) => flag.name)

    expect(globalFlagNames).toContain('--filter')
    expect(globalFlagNames).toContain('--auth')
    expect(globalFlagNames).toContain('--debug')
    expect(globalFlagNames).toContain('--help')
  })
})
