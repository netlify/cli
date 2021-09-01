const os = require('os')
const path = require('path')
const process = require('process')

const execa = require('execa')
const serializeJS = require('serialize-javascript')
const tempDirectory = require('temp-dir')
const { toToml } = require('tomlify-j0.4')
const { v4: uuidv4 } = require('uuid')

const fs = require('../../src/lib/fs')

const ensureDir = (file) => fs.mkdirRecursiveAsync(file)

const createSiteBuilder = ({ siteName }) => {
  const directory = path.join(
    tempDirectory,
    `netlify-cli-tests-${process.version}`,
    `${process.pid}`,
    uuidv4(),
    siteName,
  )
  let tasks = [() => ensureDir(directory)]

  const builder = {
    directory,
    siteName,
    withNetlifyToml: ({ config, pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, 'netlify.toml')
      const content = toToml(config, {
        replace: (_, val) => {
          // Strip off `.0` from integers that tomlify normally generates

          if (!Number.isInteger(val)) {
            // Output normal value
            return false
          }

          return String(Math.round(val))
        },
        space: 2,
      })
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(dest, content)
      })
      return builder
    },
    withPackageJson: ({ packageJson, pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, 'package.json')
      tasks.push(async () => {
        const content = JSON.stringify(packageJson, null, 2)
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
    withEdgeHandlers: ({ fileName = 'index.js', handlers }) => {
      const dest = path.join(directory, 'netlify/edge-handlers', fileName)
      tasks.push(async () => {
        const content = Object.entries(handlers)
          .map(([event, handler]) => `export const ${event} = ${handler.toString()}`)
          .join(os.EOL)
        await ensureDir(path.dirname(dest))
        await fs.writeFileAsync(dest, content)
      })
      return builder
    },
    withRedirectsFile: ({ redirects = [], pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, '_redirects')
      tasks.push(async () => {
        const content = redirects
          .map(({ from, to, status, condition = '' }) => [from, to, status, condition].filter(Boolean).join(' '))
          .join(os.EOL)
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
            ({ path: headerPath, headers: headersValues }) =>
              `${headerPath}${os.EOL}${headersValues.map((header) => `  ${header}`).join(`${os.EOL}`)}`,
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
    withCopiedFile: ({ path: filePath, src }) => {
      const dest = path.join(directory, filePath)
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await fs.copyFileAsync(src, dest)
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
    withGit: ({ repoUrl = 'git@github.com:owner/repo.git' } = {}) => {
      tasks.push(async () => {
        await execa('git', ['init', '--initial-branch', 'main'], { cwd: directory })
        await execa('git', ['remote', 'add', 'origin', repoUrl], { cwd: directory })
      })
      return builder
    },
    withoutFile: ({ path: filePath }) => {
      const dest = path.join(directory, filePath)
      tasks.push(async () => {
        await fs.rmFileAsync(dest)
      })
      return builder
    },
    withBuildPlugin: ({ name, plugin, pathPrefix = 'plugins' }) => {
      const dest = path.join(directory, pathPrefix, name)
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await Promise.all([
          fs.writeFileAsync(path.join(directory, pathPrefix, 'manifest.yml'), `name: ${name}`),
          fs.writeFileAsync(dest, `module.exports = ${serializeJS(plugin)}`),
        ])
      })
      return builder
    },
    buildAsync: async () => {
      // eslint-disable-next-line fp/no-loops
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task()
      }

      tasks = []

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
