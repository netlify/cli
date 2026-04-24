import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { processPayloadFromFlag } from '../../../../src/commands/functions/functions-invoke.js'

describe('processPayloadFromFlag', () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'netlify-cli-processpayload-'))
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  test('returns undefined when no payload string is provided', async () => {
    await expect(processPayloadFromFlag(undefined, workDir)).resolves.toBeUndefined()
    await expect(processPayloadFromFlag('', workDir)).resolves.toBeUndefined()
  })

  test('parses an inline JSON object string', async () => {
    await expect(processPayloadFromFlag('{"hello":"world","n":1}', workDir)).resolves.toEqual({
      hello: 'world',
      n: 1,
    })
  })

  test('loads a .json payload from a file path', async () => {
    const fileName = 'payload.json'
    writeFileSync(join(workDir, fileName), JSON.stringify({ from: 'file', arr: [1, 2, 3] }))

    await expect(processPayloadFromFlag(fileName, workDir)).resolves.toEqual({ from: 'file', arr: [1, 2, 3] })
  })

  test('loads an ESM .mjs payload via dynamic import and unwraps the default export', async () => {
    const fileName = 'payload.mjs'
    writeFileSync(join(workDir, fileName), `export default { source: 'mjs-default', n: 7 }\n`)

    await expect(processPayloadFromFlag(fileName, workDir)).resolves.toEqual({ source: 'mjs-default', n: 7 })
  })

  test('loads a CJS .cjs payload via dynamic import (module.exports is exposed under default)', async () => {
    const fileName = 'payload.cjs'
    writeFileSync(join(workDir, fileName), `module.exports = { source: 'cjs', n: 9 }\n`)

    await expect(processPayloadFromFlag(fileName, workDir)).resolves.toEqual({ source: 'cjs', n: 9 })
  })

  test('returns false when the referenced path does not exist and the string is not valid JSON', async () => {
    await expect(processPayloadFromFlag('does-not-exist.json', workDir)).resolves.toBe(false)
  })

  test('logs and returns false when an imported JS payload throws at load time', async () => {
    const fileName = 'broken.mjs'
    writeFileSync(join(workDir, fileName), `throw new Error('boom')\n`)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(processPayloadFromFlag(fileName, workDir)).resolves.toBe(false)
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })
})
