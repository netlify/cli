import { describe, expect, test, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import { rm } from 'fs/promises'
import { temporaryDirectory } from 'tempy'
import { handleQuestions, CONFIRM, DOWN, NO, answerWithValue } from '../../utils/handle-questions.js'
import execa from 'execa'
import { cliPath } from '../../utils/cli-path.js'
import { join } from 'path'
import { TABTAB_CONFIG_LINE, AUTOLOAD_COMPINIT } from '../../../../src/utils/command-helpers.js'

describe('completion:install command', () => {
  let tempDir
  let zshConfigPath
  let options

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
    async (t) => {
      fs.writeFileSync(zshConfigPath, TABTAB_CONFIG_LINE)
      const childProcess = execa(cliPath, ['completion:install'], options)

      handleQuestions(childProcess, [
        {
          question: 'Which Shell do you use ?',
          answer: answerWithValue(DOWN),
        },
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
    async (t) => {
      fs.writeFileSync(zshConfigPath, TABTAB_CONFIG_LINE)
      const childProcess = execa(cliPath, ['completion:install'], options)

      handleQuestions(childProcess, [
        {
          question: 'Which Shell do you use ?',
          answer: answerWithValue(DOWN),
        },
        {
          question: 'We will install completion to ~/.zshrc, is it ok ?',
          answer: CONFIRM,
        },
        {
          question: 'Would you like to add it?',
          answer: answerWithValue(NO),
        },
      ])

      await childProcess
      const content = fs.readFileSync(zshConfigPath, 'utf8')
      expect(content).not.toContain(AUTOLOAD_COMPINIT)
    },
  )
})
