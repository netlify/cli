import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import type NetlifyFunction from '../../../../../../../src/lib/functions/netlify-function.js'
import type { JsBuildResult } from '../../../../../../../src/lib/functions/runtimes/js/index.js'
import detectZisiBuilder from '../../../../../../../src/lib/functions/runtimes/js/builders/zisi.js'
import type { NormalizedCachedConfigConfig } from '../../../../../../../src/utils/command-helpers.js'

const config = { functions: { '*': {} } } as Pick<
  NormalizedCachedConfigConfig,
  'functions'
> as NormalizedCachedConfigConfig

describe('detectZisiBuilder', () => {
  let projectRoot: string

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'zisi-builder-'))
  })

  afterEach(async () => {
    await rm(projectRoot, { force: true, recursive: true })
  })

  const createFunction = async (packageType: 'commonjs' | 'module') => {
    const functionDirectory = join(projectRoot, 'netlify', 'functions', 'hello')
    await mkdir(functionDirectory, { recursive: true })
    await writeFile(join(functionDirectory, 'package.json'), JSON.stringify({ type: packageType }))
    const mainFile = join(functionDirectory, 'hello.js')
    await writeFile(mainFile, '')

    return { mainFile } as Pick<NetlifyFunction<JsBuildResult>, 'mainFile'> as NetlifyFunction<JsBuildResult>
  }

  // The CLI's own package.json has `"type": "module"`, so these only pass when the lookup starts at the function
  test('does not bundle with esbuild when the package.json next to the function is CommonJS', async () => {
    const func = await createFunction('commonjs')

    const builder = await detectZisiBuilder({ config, errorExit: () => undefined, func, projectRoot })

    expect(builder).toBe(false)
  })

  test('bundles with esbuild when the package.json next to the function has `"type": "module"`', async () => {
    const func = await createFunction('module')

    const builder = await detectZisiBuilder({ config, errorExit: () => undefined, func, projectRoot })

    expect(builder).toMatchObject({ builderName: 'zip-it-and-ship-it' })
  })
})
