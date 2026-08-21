import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { backUpCorruptJsonFile, guardLocalStateFile } from '../../../src/utils/config-guard.js'

const mockStderr = () => vi.spyOn(process.stderr, 'write').mockReturnValue(true)

describe('config corruption guard', () => {
  let dir: string
  let stderrSpy: ReturnType<typeof mockStderr>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'netlify-config-guard-'))
    stderrSpy = mockStderr()
  })

  afterEach(() => {
    stderrSpy.mockRestore()
    rmSync(dir, { recursive: true, force: true })
  })

  const stderrOutput = () => stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('')

  test('returns undefined for a missing file', () => {
    expect(backUpCorruptJsonFile(join(dir, 'missing.json'), 'fix it')).toBeUndefined()
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  test('returns undefined for valid JSON and writes no backup', () => {
    const filePath = join(dir, 'state.json')
    writeFileSync(filePath, '{"siteId":"123"}')
    expect(backUpCorruptJsonFile(filePath, 'fix it')).toBeUndefined()
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  test('returns undefined for an empty file', () => {
    const filePath = join(dir, 'state.json')
    writeFileSync(filePath, '')
    expect(backUpCorruptJsonFile(filePath, 'fix it')).toBeUndefined()
  })

  test('backs up a corrupt file and warns on stderr naming both paths', () => {
    const filePath = join(dir, 'state.json')
    writeFileSync(filePath, '{ totally not json')

    const backupPath = backUpCorruptJsonFile(filePath, 'run netlify link')

    expect(backupPath).toMatch(/state\.json\.corrupt\.\d+$/)
    expect(existsSync(backupPath ?? '')).toBe(true)
    expect(readFileSync(backupPath ?? '', 'utf8')).toBe('{ totally not json')

    const output = stderrOutput()
    expect(output).toContain(filePath)
    expect(output).toContain(backupPath)
    expect(output).toContain('run netlify link')
  })

  test('does not overwrite an existing backup for the same mtime', () => {
    const filePath = join(dir, 'state.json')
    writeFileSync(filePath, 'garbage')

    const first = backUpCorruptJsonFile(filePath, 'fix it')
    const second = backUpCorruptJsonFile(filePath, 'fix it')

    expect(first).toBe(second)
    expect(readFileSync(first ?? '', 'utf8')).toBe('garbage')
  })

  test('guardLocalStateFile resolves .netlify/state.json from the working directory', async () => {
    const projectDir = join(dir, 'project')
    writeFileSync(join(dir, 'unrelated.txt'), '', { flag: 'w' })
    const stateDir = join(projectDir, '.netlify')
    const { mkdirSync } = await import('fs')
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(join(stateDir, 'state.json'), 'not json at all')

    const backupPath = await guardLocalStateFile(projectDir)

    expect(backupPath).toMatch(/state\.json\.corrupt\.\d+$/)
    expect(existsSync(backupPath ?? '')).toBe(true)
  })

  test('guardLocalStateFile is a no-op when no state file exists', async () => {
    const projectDir = join(dir, 'empty-project')
    const { mkdirSync } = await import('fs')
    mkdirSync(projectDir, { recursive: true })
    await expect(guardLocalStateFile(projectDir)).resolves.toBeUndefined()
  })
})
