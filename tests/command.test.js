const process = require('process')

const test = require('ava')

const callCli = require('./utils/call-cli')
const { withSiteBuilder } = require('./utils/site-builder')

test('should warn when "netlify" dir exists', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    builder.withContentFile({
      path: 'netlify/test.txt',
      content: 'Hello World',
    })

    await builder.buildAsync()

    const cliResponse = await callCli(['dev:exec', 'arp'], {
      cwd: builder.directory,
    })
    t.true(cliResponse.includes('Detected site repository path: netlify'))
  })
})

test('should warn when "netlify/functions" dir exists', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    builder.withContentFile({
      path: 'netlify/functions/script.js',
      content: 'console.log("Hello World")',
    })

    await builder.buildAsync()

    const cliResponse = await callCli(['dev:exec', 'arp'], {
      cwd: builder.directory,
    })

    const path = process.platform === 'win32' ? 'netlify\\functions' : 'netlify/functions'
    t.true(cliResponse.includes(`Detected site repository path: ${path}`))
  })
})
