import { readFile } from 'fs/promises'
import { resolve } from 'path'

import test from 'ava'
import { parse } from 'comment-json'
import execa from 'execa'

import callCli from '../../utils/call-cli.cjs'
import cliPath from '../../utils/cli-path.cjs'
import { CONFIRM, NO, answerWithValue, handleQuestions } from '../../utils/handle-questions.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'
import { normalize } from '../../utils/snapshots.cjs'

test('Shows a list of all the available recipes', async (t) => {
  const cliResponse = await callCli(['recipes:list'])

  t.snapshot(normalize(cliResponse))
})

test('Generates a new VS Code settings file if one does not exist', async (t) => {
  await withSiteBuilder('repo', async (builder) => {
    await builder.buildAsync()

    const childProcess = execa(cliPath, ['recipes', 'vscode'], {
      cwd: builder.directory,
    })
    const settingsPath = resolve(builder.directory, '.vscode', 'settings.json')

    handleQuestions(childProcess, [
      {
        question: `A new VS Code settings file will be created at ${settingsPath}`,
        answer: CONFIRM,
      },
    ])

    await childProcess

    const settings = JSON.parse(await readFile(`${builder.directory}/.vscode/settings.json`))

    t.is(settings['deno.enable'], true)
    t.is(settings['deno.importMap'], '.netlify/edge-functions-import-map.json')
    t.deepEqual(settings['deno.enablePaths'], ['netlify/edge-functions'])
  })
})

test('Updates an existing VS Code settings file', async (t) => {
  await withSiteBuilder('repo', async (builder) => {
    await builder
      .withContentFile({
        path: '.vscode/settings.json',
        content: JSON.stringify({ 'deno.enablePaths': ['/some/path'], someSetting: 'value' }),
      })
      .buildAsync()

    const childProcess = execa(cliPath, ['recipes', 'vscode'], {
      cwd: builder.directory,
    })
    const settingsPath = resolve(builder.directory, '.vscode', 'settings.json')

    handleQuestions(childProcess, [
      {
        question: `There is a VS Code settings file at ${settingsPath}. Can we update it?`,
        answer: CONFIRM,
      },
    ])

    await childProcess

    const settings = JSON.parse(await readFile(`${builder.directory}/.vscode/settings.json`))

    t.is(settings.someSetting, 'value')
    t.is(settings['deno.enable'], true)
    t.is(settings['deno.importMap'], '.netlify/edge-functions-import-map.json')
    t.deepEqual(settings['deno.enablePaths'], ['/some/path', 'netlify/edge-functions'])
  })
})

test('Does not generate a new VS Code settings file if the user does not confirm the prompt', async (t) => {
  await withSiteBuilder('repo', async (builder) => {
    await builder.buildAsync()

    const childProcess = execa(cliPath, ['recipes', 'vscode'], {
      cwd: builder.directory,
    })
    const settingsPath = resolve(builder.directory, '.vscode', 'settings.json')

    handleQuestions(childProcess, [
      {
        question: `A new VS Code settings file will be created at ${settingsPath}`,
        answer: answerWithValue(NO),
      },
    ])

    await childProcess

    const error = await t.throwsAsync(() => readFile(`${builder.directory}/.vscode/settings.json`))
    t.is(error.code, 'ENOENT')
  })
})

test('Handles JSON with comments', async (t) => {
  await withSiteBuilder('repo', async (builder) => {
    const comment = '// sets value for someSetting'
    await builder
      .withContentFile({
        path: '.vscode/settings.json',
        content: `{
          "deno.enablePaths":["/some/path"],
          "someSetting":"value" ${comment}
        }`,
      })
      .buildAsync()

    const childProcess = execa(cliPath, ['recipes', 'vscode'], {
      cwd: builder.directory,
    })
    const settingsPath = resolve(builder.directory, '.vscode', 'settings.json')

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

    const settingsText = await readFile(`${builder.directory}/.vscode/settings.json`, { encoding: 'utf8' })
    t.true(settingsText.includes(comment))

    const settings = parse(settingsText, null, true)
    t.is(settings.someSetting, 'value')
    t.is(settings['deno.enable'], true)
    t.is(settings['deno.importMap'], '.netlify/edge-functions-import-map.json')
    t.deepEqual([...settings['deno.enablePaths']], ['/some/path', 'netlify/edge-functions'])
  })
})

test('Suggests closest matching recipe on typo', async (t) => {
  const cliResponse = await callCli(['recipes', 'vsc'])

  t.snapshot(normalize(cliResponse))
})
