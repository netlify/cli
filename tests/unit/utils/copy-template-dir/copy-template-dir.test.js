import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import readdirp from 'readdirp'
import { describe, expect, test } from 'vitest'

import { copyTemplateDir } from '../../../../dist/utils/copy-template-dir/copy-template-dir.js'

// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url)
// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(__filename)

describe('copyTemplateDir', () => {
  test('should assert input values', async () => {
    await expect(copyTemplateDir()).rejects.toThrow(/string/)
    await expect(copyTemplateDir('foo')).rejects.toThrow(/string/)
    await expect(copyTemplateDir('foo', 'bar', 'err')).rejects.toThrow(/object/)
  })

  test('should write a bunch of files', async () => {
    const checkCreatedFileNames = (names) => {
      expect(names).toContain('.a')
      expect(names).toContain('c')
      expect(names).toContain('1.txt')
      expect(names).toContain('2.txt')
      expect(names).toContain('3.txt')
      expect(names).toContain('.txt')
      expect(names).toContain(`foo${path.sep}.b`)
      expect(names).toContain(`foo${path.sep}d`)
      expect(names).toContain(`foo${path.sep}4.txt`)
    }

    const inDir = path.join(__dirname, 'fixtures')
    const outDir = path.join(__dirname, '../tmp')

    const createdFiles = await copyTemplateDir(inDir, outDir, {})

    expect(Array.isArray(createdFiles)).toBe(true)
    expect(createdFiles.length).toBe(10)

    // Checks the direct output of the function, to ensure names are correct
    checkCreatedFileNames(createdFiles.map((filePath) => path.relative(outDir, filePath)))

    // Checks that the files were created in the file system
    const files = await readdirp.promise(outDir)
    checkCreatedFileNames(files.map((file) => file.path))

    // Cleanup
    fs.rmdirSync(outDir, { recursive: true })
  })

  test('should inject context variables strings', async () => {
    const inDir = path.join(__dirname, 'fixtures')
    const outDir = path.join(__dirname, '../tmp')

    await copyTemplateDir(inDir, outDir, { foo: 'bar' })

    const fileContent = fs.readFileSync(path.join(outDir, '1.txt'), 'utf-8').trim()
    expect(fileContent).toBe('hello bar sama')

    // Cleanup
    fs.rmdirSync(outDir, { recursive: true })
  })

  test('should inject context variables strings into filenames', async () => {
    const inDir = path.join(__dirname, 'fixtures')
    const outDir = path.join(__dirname, '../tmp')

    await copyTemplateDir(inDir, outDir, { foo: 'bar' })

    expect(fs.existsSync(path.join(outDir, 'bar.txt'))).toBe(true)

    // Cleanup
    fs.rmdirSync(outDir, { recursive: true })
  })

  test('should inject context variables strings into directory names', async () => {
    const inDir = path.join(__dirname, 'fixtures')
    const outDir = path.join(__dirname, '../tmp')

    await copyTemplateDir(inDir, outDir, { foo: 'bar' })

    expect(fs.existsSync(path.join(outDir, 'bar'))).toBe(true)

    // Cleanup
    fs.rmdirSync(outDir, { recursive: true })
  })
})
