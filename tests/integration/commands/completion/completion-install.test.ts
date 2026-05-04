import { describe, test, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import { rm } from 'fs/promises'
import { handleQuestions, CONFIRM, NO } from '../../utils/handle-questions.js'
import execa from 'execa'
import { cliPath } from '../../utils/cli-path.js'
import { join } from 'path'
import { TABTAB_CONFIG_LINE, AUTOLOAD_COMPINIT } from '../../../../src/utils/command-helpers.js'
import { temporaryDirectory } from '../../../../src/utils/temporary-file.js'

describe('completion:install command', () => {
  let tempDir: string
  let zshConfigPath: string
  let options: execa.Options

  beforeAll(() => {
    tempDir = temporaryDirectory()
    zshConfigPath = join(tempDir, '.zshrc')
    options = { cwd: tempDir, env: { HOME: tempDir } }
  })

  afterAll(async () => {
    await rm(tempDir, { force: true, recursive: true })
  })

  test.skipIf(process.env.SHELL !== '/bin/zsh')(
    'should add compinit to .zshrc when user confirms prompt',
    async ({ expect }) => {
      fs.writeFileSync(zshConfigPath, TABTAB_CONFIG_LINE)
      const childProcess = execa(cliPath, ['completion:install', '--shell', 'zsh'], options)

      handleQuestions(childProcess, [
        {
          question: 'We will install completion to ~/.zshrc, is it ok ?',
          answer: CONFIRM,
        },
        {
          question: 'Would you like to add it?',
          answer: CONFIRM,
        },
      ])

      await childProcess
      const content = fs.readFileSync(zshConfigPath, 'utf8')
      expect(content).toContain(AUTOLOAD_COMPINIT)
    },
  )

  test.skipIf(process.env.SHELL !== '/bin/zsh')(
    'should not add compinit to .zshrc when user does not confirm prompt',
    async ({ expect }) => {
      fs.writeFileSync(zshConfigPath, TABTAB_CONFIG_LINE)
      const childProcess = execa(cliPath, ['completion:install', '--shell', 'zsh'], options)

      handleQuestions(childProcess, [
        {
          question: 'We will install completion to ~/.zshrc, is it ok ?',
          answer: CONFIRM,
        },
        {
          question: 'Would you like to add it?',
          answer: [NO, CONFIRM],
        },
      ])

      await childProcess
      const content = fs.readFileSync(zshConfigPath, 'utf8')
      expect(content).not.toContain(AUTOLOAD_COMPINIT)
    },
  )
})
