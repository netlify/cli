import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { getPackageJSON } from '../../../../../src/commands/database/legacy/utils.js'

describe('getPackageJSON', () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'netlify-cli-getpkgjson-'))
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  const writePackageJson = (contents: unknown) => {
    writeFileSync(join(workDir, 'package.json'), typeof contents === 'string' ? contents : JSON.stringify(contents))
  }

  test('reads and parses a valid package.json', () => {
    writePackageJson({
      name: 'my-app',
      version: '1.0.0',
      dependencies: { foo: '^1.0.0' },
      devDependencies: { bar: '^2.0.0' },
      scripts: { build: 'tsc' },
    })

    expect(getPackageJSON(workDir)).toEqual({
      name: 'my-app',
      version: '1.0.0',
      dependencies: { foo: '^1.0.0' },
      devDependencies: { bar: '^2.0.0' },
      scripts: { build: 'tsc' },
    })
  })

  test('accepts a package.json without optional fields', () => {
    writePackageJson({ name: 'bare' })
    expect(getPackageJSON(workDir)).toEqual({ name: 'bare' })
  })

  test('throws when package.json is missing', () => {
    expect(() => getPackageJSON(workDir)).toThrow()
  })

  test('throws when package.json is not valid JSON', () => {
    writePackageJson('{ not json')
    expect(() => getPackageJSON(workDir)).toThrow()
  })

  test('throws when the parsed value is not an object', () => {
    writePackageJson('"just a string"')
    expect(() => getPackageJSON(workDir)).toThrow('Failed to load package.json')
  })

  test('throws when dependencies is not an object', () => {
    writePackageJson({ dependencies: 'oops' })
    expect(() => getPackageJSON(workDir)).toThrow('Expected object at package.json#dependencies, got string')
  })

  test('throws when devDependencies is not an object', () => {
    writePackageJson({ devDependencies: 42 })
    expect(() => getPackageJSON(workDir)).toThrow('Expected object at package.json#devDependencies, got number')
  })

  test('throws when scripts is not an object', () => {
    writePackageJson({ scripts: true })
    expect(() => getPackageJSON(workDir)).toThrow('Expected object at package.json#scripts, got boolean')
  })
})
