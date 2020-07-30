const { toToml } = require('tomlify-j0.4')
const fs = require('fs-extra')
const path = require('path')
const tempy = require('tempy')
const os = require('os')

const createSiteBuilder = ({ siteName }) => {
  const directory = path.join(tempy.directory({ prefix: `netlify-cli-tests-${process.version}` }), siteName)
  const tasks = [() => fs.ensureDir(directory)]

  const builder = {
    directory,
    siteName,
    withNetlifyToml: ({ config, pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, 'netlify.toml')
      const content = toToml(config, { space: 2 })
      tasks.push(async () => {
        await fs.ensureFile(dest)
        await fs.writeFile(dest, content)
      })
      return builder
    },
    withPackageJson: ({ object, pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, 'package.json')
      tasks.push(async () => {
        await fs.ensureFile(dest)
        await fs.writeJSON(dest, object, { spaces: 2 })
      })
      return builder
    },
    withFunction: ({ pathPrefix = 'functions', path: filePath, handler }) => {
      const dest = path.join(directory, pathPrefix, filePath)
      tasks.push(async () => {
        await fs.ensureFile(dest)
        await fs.writeFile(dest, `exports.handler = ${handler.toString()}`)
      })
      return builder
    },
    withRedirectsFile: ({ redirects = [], pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, '_redirects')
      tasks.push(async () => {
        await fs.ensureFile(dest)
        const content = redirects.map(({ from, to, status }) => `${from}      ${to}       ${status}`).join(os.EOL)
        await fs.writeFile(dest, content)
      })
      return builder
    },
    withHeadersFile: ({ headers = [], pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, '_headers')
      tasks.push(async () => {
        await fs.ensureFile(dest)
        const content = headers
          .map(
            ({ path: headerPath, headers }) => `${headerPath}${os.EOL}${headers.map(h => `  ${h}`).join(`${os.EOL}`)}`
          )
          .join(os.EOL)
        await fs.writeFile(dest, content)
      })
      return builder
    },
    withContentFile: ({ path: filePath, content }) => {
      const dest = path.join(directory, filePath)
      tasks.push(async () => {
        await fs.ensureFile(dest)
        await fs.writeFile(dest, content)
      })
      return builder
    },
    withEnvFile: ({ path: filePath = '.env', pathPrefix = '', env = {} }) => {
      const dest = path.join(directory, pathPrefix, filePath)
      tasks.push(async () => {
        await fs.ensureFile(dest)
        await fs.writeFile(
          dest,
          Object.entries(env)
            .map(([key, value]) => `${key}=${value}`)
            .join(os.EOL)
        )
      })
      return builder
    },
    buildAsync: async () => {
      for (const task of tasks) {
        await task()
      }
      return builder
    },
    cleanupAsync: async () => {
      await fs.remove(directory).catch(e => {
        console.warn(e)
      })
      return builder
    },
  }

  return builder
}

const withSiteBuilder = async (siteName, testHandler) => {
  let builder
  try {
    builder = createSiteBuilder({ siteName })
    return await testHandler(builder)
  } finally {
    await builder.cleanupAsync()
  }
}

module.exports = { withSiteBuilder, createSiteBuilder }
