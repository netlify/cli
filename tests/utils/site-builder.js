const { toToml } = require('tomlify-j0.4')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const tempDirectory = require('temp-dir')
const os = require('os')

const fs = require('../../src/lib/fs')

const ensureDir = (path) => {
  return fs.mkdirRecursiveAsync(path)
}

const createSiteBuilder = ({ siteName }) => {
  const directory = path.join(
    tempDirectory,
    `netlify-cli-tests-${process.version}`,
    `${process.pid}`,
    uuidv4(),
    siteName,
  )
  const tasks = [() => ensureDir(directory)]

  const builder = {
    directory,
    siteName,
    withNetlifyToml: ({ config, pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, 'netlify.toml')
      const content = toToml(config, { space: 2 })
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(dest, content)
      })
      return builder
    },
    withPackageJson: ({ object, pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, 'package.json')
      tasks.push(async () => {
        const content = JSON.stringify(object, null, 2)
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(dest, `${content}\n`)
      })
      return builder
    },
    withFunction: ({ pathPrefix = 'functions', path: filePath, handler }) => {
      const dest = path.join(directory, pathPrefix, filePath)
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(dest, `exports.handler = ${handler.toString()}`)
      })
      return builder
    },
    withEdgeHandlers: ({ handlers }) => {
      const dest = path.join(directory, 'edge-handlers', 'index.js')
      tasks.push(async () => {
        const content = Object.entries(handlers)
          .map(([event, handler]) => {
            return `export const ${event} = ${handler.toString()}`
          })
          .join('\n')
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(dest, content)
      })
      return builder
    },
    withRedirectsFile: ({ redirects = [], pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, '_redirects')
      tasks.push(async () => {
        const content = redirects.map(({ from, to, status }) => `${from}      ${to}       ${status}`).join(os.EOL)
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(dest, content)
      })
      return builder
    },
    withHeadersFile: ({ headers = [], pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, '_headers')
      tasks.push(async () => {
        const content = headers
          .map(
            ({ path: headerPath, headers }) =>
              `${headerPath}${os.EOL}${headers.map((h) => `  ${h}`).join(`${os.EOL}`)}`,
          )
          .join(os.EOL)
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(dest, content)
      })
      return builder
    },
    withContentFile: ({ path: filePath, content }) => {
      const dest = path.join(directory, filePath)
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(dest, content)
      })
      return builder
    },
    withContentFiles: (files) => {
      files.forEach(builder.withContentFile)
      return builder
    },
    withEnvFile: ({ path: filePath = '.env', pathPrefix = '', env = {} }) => {
      const dest = path.join(directory, pathPrefix, filePath)
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(
          dest,
          Object.entries(env)
            .map(([key, value]) => `${key}=${value}`)
            .join(os.EOL),
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
      await fs.rmdirRecursiveAsync(directory).catch((error) => {
        console.warn(error)
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
