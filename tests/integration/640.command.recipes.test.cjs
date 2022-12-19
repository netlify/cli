const { readFile } = require('fs/promises')
const { resolve } = require('path')

const test = require('ava')
const execa = require('execa')

const callCli = require('./utils/call-cli.cjs')
const cliPath = require('./utils/cli-path.cjs')
const { CONFIRM, answerWithValue, handleQuestions } = require('./utils/handle-questions.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')
const { normalize } = require('./utils/snapshots.cjs')

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
        answer: answerWithValue(CONFIRM),
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
        answer: answerWithValue(CONFIRM),
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
        answer: answerWithValue('n'),
      },
    ])

    await childProcess

    const error = await t.throwsAsync(() => readFile(`${builder.directory}/.vscode/settings.json`))
    t.is(error.code, 'ENOENT')
  })
})
