import { describe, expect, test, vi } from 'vitest'
import os from 'os'
import fs from 'fs'
import { isFileAsync } from '../../../../src/lib/fs.js'
import { temporaryFile, temporaryDirectory } from 'tempy'
import { callCli } from '../../utils/call-cli'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'
import { handleQuestions, CONFIRM, DOWN, NO, answerWithValue } from '../../utils/handle-questions.js'
import execa from 'execa'
import { cliPath } from '../../utils/cli-path.js'

import { join } from 'path'

const TABTAB_CONFIG_LINE = '[[ -f ~/.config/tabtab/__tabtab.zsh ]] && . ~/.config/tabtab/__tabtab.zsh || true'
const AUTOLOAD_COMPINIT = 'autoload -U compinit; compinit'
vi.mock('os')


// vi.mocked(os.homedir).mockReturnValue('/Users/testuser')
// vi.mocked(fs.existsSync).mockReturnValue(true)
// vi.mocked(fs.readFileSync).mockReturnValue(`${TABTAB_CONFIG_LINE}`)
// create a ...
// /Users/testuser/.zshrc
// write tabtab config line to it
// call completion install command
// expect mock zshfile to contain autoload_compinit line

describe('completion:install command', () => {
  test.skipIf(process.env.SHELL !== '/bin/zsh')('should be zsh', async (t) => {

    await withSiteBuilder(t, async (builder) => {

      const tempDir = temporaryDirectory()
      const zshConfigPath = join(tempDir, '.zshrc')
      fs.writeFileSync(zshConfigPath, TABTAB_CONFIG_LINE)
      vi.mocked(os.homedir).mockReturnValueOnce(tempDir)

      const projectPath = join('projects', 'project1')
      await builder.withNetlifyToml({ config: {}, pathPrefix: projectPath }).build()
      
      await withMockApi(
        [],
        async ({ apiUrl }) => {
          const options = getCLIOptions({ builder, apiUrl })
          console.log(builder.directory)
          const childProcess = execa(cliPath, ['completion:install'], getCLIOptions({ apiUrl, builder, env: { HOME: tempDir } }))
          // const childProcess = execa(cliPath, ['completion:install'])
          handleQuestions(childProcess, [
            {
              question: "Which Shell do you use ?",
              answer: answerWithValue(DOWN)
            },
            {
              question: "We will install completion to ~/.zshrc, is it ok ?",
              answer: CONFIRM
            },
            {
              question: "Would you like to add it?",
              answer: CONFIRM,
            },
          ])


          await childProcess
          const content = fs.readFileSync(zshConfigPath, 'utf8')
          console.log(content)
          expect(content).toContain(AUTOLOAD_COMPINIT)
          
        },
        true,
      )
      })

  })
  
  test.skipIf(process.env.SHELL !== '/bin/zsh')('should be zsh', async (t) => {

    await withSiteBuilder(t, async (builder) => {

      const tempDir = temporaryDirectory()
      const zshConfigPath = join(tempDir, '.zshrc')
      fs.writeFileSync(zshConfigPath, TABTAB_CONFIG_LINE)
      vi.mocked(os.homedir).mockReturnValueOnce(tempDir)

      const projectPath = join('projects', 'project1')
      await builder.withNetlifyToml({ config: {}, pathPrefix: projectPath }).build()
      
      await withMockApi(
        [],
        async ({ apiUrl }) => {
          const options = getCLIOptions({ builder, apiUrl })
          console.log(builder.directory)
          const childProcess = execa(cliPath, ['completion:install'], getCLIOptions({ apiUrl, builder, env: { HOME: tempDir } }))
          // const childProcess = execa(cliPath, ['completion:install'])
          handleQuestions(childProcess, [
            {
              question: "Which Shell do you use ?",
              answer: answerWithValue(DOWN)
            },
            {
              question: "We will install completion to ~/.zshrc, is it ok ?",
              answer: CONFIRM
            },
            {
              question: "Would you like to add it?",
              answer: NO,
            },
          ])


          await childProcess
          const content = fs.readFileSync(zshConfigPath, 'utf8')
          console.log(content)
          expect(content).not.toContain(AUTOLOAD_COMPINIT)
          
        },
        true,
      )
      })

  })
})
