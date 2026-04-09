import fs from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'comment-json'
import execa from 'execa'
import { describe, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { cliPath } from '../../utils/cli-path.js'
import { CONFIRM, NO, answerWithValue, handleQuestions } from '../../utils/handle-questions.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { normalize } from '../../utils/snapshots.js'

describe.concurrent('commands/recipes', () => {
  test('Shows a list of all the available recipes', async (t) => {
    const cliResponse = (await callCli(['recipes:list'])) as string

    t.expect(normalize(cliResponse)).toMatchSnapshot()
  })

  test('Generates a new VS Code settings file if one does not exist', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      const childProcess = execa(cliPath, ['recipes', 'vscode'], {
        cwd: builder.directory,
      })
      const settingsPath = path.resolve(builder.directory, '.vscode', 'settings.json')

      handleQuestions(childProcess, [
        {
          question: `A new VS Code settings file will be created at ${settingsPath}`,
          answer: CONFIRM,
        },
      ])

      await childProcess

      const settings = JSON.parse(
        await fs.readFile(path.join(builder.directory, `.vscode/settings.json`), 'utf8'),
      ) as unknown

      t.expect(settings).toHaveProperty('deno.enable', true)
      t.expect(settings).toHaveProperty('deno.importMap', '.netlify/edge-functions-import-map.json')
      t.expect(settings).toHaveProperty('deno.enablePaths', ['netlify/edge-functions'])
    })
  })

  test('Updates an existing VS Code settings file', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: '.vscode/settings.json',
          content: JSON.stringify({ 'deno.enablePaths': ['/some/path'], someSetting: 'value' }),
        })
        .build()

      const childProcess = execa(cliPath, ['recipes', 'vscode'], {
        cwd: builder.directory,
      })
      const settingsPath = path.resolve(builder.directory, '.vscode', 'settings.json')

      handleQuestions(childProcess, [
        {
          question: `There is a VS Code settings file at ${settingsPath}. Can we update it?`,
          answer: CONFIRM,
        },
      ])

      await childProcess

      const settings = JSON.parse(
        await fs.readFile(path.join(builder.directory, `.vscode/settings.json`), 'utf8'),
      ) as unknown

      t.expect(settings).toHaveProperty('someSetting', 'value')
      t.expect(settings).toHaveProperty('deno.enable', true)
      t.expect(settings).toHaveProperty('deno.importMap', '.netlify/edge-functions-import-map.json')
      t.expect(settings).toHaveProperty('deno.enablePaths', ['/some/path', 'netlify/edge-functions'])
    })
  })

  test('Does not generate a new VS Code settings file if the user does not confirm the prompt', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      const childProcess = execa(cliPath, ['recipes', 'vscode'], {
        cwd: builder.directory,
      })
      const settingsPath = path.resolve(builder.directory, '.vscode', 'settings.json')

      handleQuestions(childProcess, [
        {
          question: `A new VS Code settings file will be created at ${settingsPath}`,
          answer: answerWithValue(NO),
        },
      ])

      await childProcess

      try {
        await fs.readFile(path.join(builder.directory, `.vscode/settings.json`), 'utf8')
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('code', 'ENOENT')
      }
    })
  })

  test('Handles JSON with comments', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const comment = '// sets value for someSetting'
      await builder
        .withContentFile({
          path: '.vscode/settings.json',
          content: `{
          "deno.enablePaths":["/some/path"],
          "someSetting":"value" ${comment}
        }`,
        })
        .build()

      const childProcess = execa(cliPath, ['recipes', 'vscode'], {
        cwd: builder.directory,
      })
      const settingsPath = path.resolve(builder.directory, '.vscode', 'settings.json')

      handleQuestions(childProcess, [
        {
          question: `There is a VS Code settings file at ${settingsPath}. Can we update it?`,
          answer: CONFIRM,
        },
        {
          question: 'The Deno VS Code extension is recommended. Would you like to install it now?',
          answer: answerWithValue(NO),
        },
      ])

      await childProcess

      const settingsText = await fs.readFile(path.join(builder.directory, `.vscode/settings.json`), 'utf8')
      t.expect(settingsText.includes(comment)).toBe(true)

      const settings = parse(settingsText, null, true)
      t.expect(settings).toHaveProperty('someSetting', 'value')
      t.expect(settings).toHaveProperty('deno.enable', true)
      t.expect(settings).toHaveProperty('deno.importMap', '.netlify/edge-functions-import-map.json')
      t.expect(settings).toHaveProperty('deno.enablePaths', ['/some/path', 'netlify/edge-functions'])
    })
  })

  test('Suggests closest matching recipe on typo', async (t) => {
    const cliResponse = (await callCli(['recipes', 'vsc'])) as string

    t.expect(normalize(cliResponse)).toMatchSnapshot()
  })
})
