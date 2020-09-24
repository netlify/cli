const test = require('ava')
const execa = require('execa')
const sinon = require('sinon')
const path = require('path')
const { serverSettings } = require('./detect-server')
const { withSiteBuilder } = require('../../tests/utils/siteBuilder')

const setupFrameworkSite = async (command, options) => {
  const parts = command.split(' ')
  const file = parts[0]
  await execa(file, parts.slice(1), options)
}

const frameworks = [
  {
    name: 'angular',
    getSetupData: baseDirectory => ({
      command: `npx -p @angular/cli@6 ng new angular-site --skip-install --directory=${baseDirectory} --minimal=true --skipGit=true --defaults=true`,
    }),
    expectedSettings: {
      framework: 'angular',
      command: 'npm',
      frameworkPort: 4200,
      possibleArgsArrs: [['start'], ['build']],
      dist: 'dist',
      args: ['start'],
      port: 8888,
      jwtRolePath: 'app_metadata.authorization.roles',
      functions: undefined,
    },
  },
  {
    name: 'eleventy',
    getSetupData: baseDirectory => ({
      command: `git clone https://github.com/11ty/eleventy-base-blog.git ${baseDirectory}`,
    }),
    expectedSettings: {
      framework: 'eleventy',
      command: 'npx',
      frameworkPort: 8080,
      possibleArgsArrs: [['eleventy', '--serve', '--watch']],
      dist: '_site',
      args: ['eleventy', '--serve', '--watch'],
      port: 8888,
      jwtRolePath: 'app_metadata.authorization.roles',
      functions: undefined,
    },
  },
  {
    name: 'gatsby',
    getSetupData: baseDirectory => ({
      command: `git clone https://github.com/gatsbyjs/gatsby-starter-hello-world.git ${baseDirectory}`,
    }),
    expectedSettings: {
      framework: 'gatsby',
      command: 'yarn',
      frameworkPort: 8000,
      possibleArgsArrs: [['develop'], ['start']],
      dist: 'public',
      args: ['develop'],
      port: 8888,
      jwtRolePath: 'app_metadata.authorization.roles',
      functions: undefined,
      env: { GATSBY_LOGGER: 'yurnalist' },
    },
  },
  {
    name: 'next',
    getSetupData: baseDirectory => ({
      command: `git clone https://github.com/vercel/next-learn-starter ${baseDirectory}`,
      projectDir: 'learn-starter',
    }),
    expectedSettings: {
      framework: 'next',
      command: 'npm',
      frameworkPort: 3000,
      possibleArgsArrs: [['run', 'dev'], ['build'], ['start']],
      dist: 'out',
      args: ['run', 'dev'],
      port: 8888,
      jwtRolePath: 'app_metadata.authorization.roles',
      functions: undefined,
    },
  },
  {
    name: 'svelte',
    getSetupData: baseDirectory => ({
      command: `git clone https://github.com/sveltejs/template.git ${baseDirectory}`,
    }),
    expectedSettings: {
      framework: 'svelte',
      command: 'npm',
      frameworkPort: 5000,
      possibleArgsArrs: [['run', 'dev'], ['start']],
      dist: 'public',
      args: ['run', 'dev'],
      port: 8888,
      jwtRolePath: 'app_metadata.authorization.roles',
      functions: undefined,
    },
  },
  {
    name: 'vue',
    getSetupData: baseDirectory => ({
      command: `npx -p @vue/cli@3 vue create ${baseDirectory} --default --no-git --bare --force`,
    }),
    expectedSettings: {
      framework: 'vue',
      command: 'yarn',
      frameworkPort: 8080,
      possibleArgsArrs: [['serve']],
      dist: 'dist',
      args: ['serve'],
      port: 8888,
      jwtRolePath: 'app_metadata.authorization.roles',
      functions: undefined,
    },
  },
]

test.before(t => {
  t.context.clock = sinon.useFakeTimers()
})

test.beforeEach(t => {
  // this is required since `get-port` locks ports for 15-30 seconds
  t.context.clock.tick(30 * 1000)
})

frameworks.forEach(framework => {
  // detectors run in the current directory at the moment, so we can't run tests in parallel
  test.serial(`should detect framework ${framework.name}`, async t => {
    await withSiteBuilder(`framework-site-${framework.name}`, async builder => {
      await builder.buildAsync()
      const { command, projectDir = '' } = framework.getSetupData(path.basename(builder.directory))
      const siteDir = path.join(builder.directory, projectDir)
      await setupFrameworkSite(command, { cwd: path.dirname(builder.directory) })

      const cwd = process.cwd()
      try {
        // TODO: refactor detectors not to rely on the current working directory
        process.chdir(siteDir)

        // functionsPort is randomized
        const settings = await serverSettings({ framework: '#auto' }, {}, siteDir, () => {})
        t.deepEqual(settings, framework.expectedSettings)
      } finally {
        process.chdir(cwd)
        // clear modules cache since running the detection memoizes the site's package.json at the module level
        // TODO: refactor detectors not to use module level variables
        Object.keys(require.cache).forEach(key => {
          delete require.cache[key]
        })
      }
    })
  })
})

test.after(t => {
  t.context.clock.restore()
})
