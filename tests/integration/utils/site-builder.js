// @ts-check
const { copyFile, mkdir, unlink, writeFile } = require('fs').promises
const os = require('os')
const path = require('path')
const process = require('process')

const execa = require('execa')
const serializeJS = require('serialize-javascript')
const tempDirectory = require('temp-dir')
const { toToml } = require('tomlify-j0.4')
const { v4: uuidv4 } = require('uuid')

const { rmdirRecursiveAsync } = require('../../../src/lib/fs')

const ensureDir = (file) => mkdir(file, { recursive: true })

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
        await writeFile(dest, content)
      })
      return builder
    },
    withPackageJson: ({ packageJson, pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, 'package.json')
      tasks.push(async () => {
        const content = JSON.stringify(packageJson, null, 2)
        await ensureDir(path.dirname(dest))
        await writeFile(dest, `${content}\n`)
      })
      return builder
    },
    withFunction: ({ esm = false, handler, path: filePath, pathPrefix = 'functions' }) => {
      const dest = path.join(directory, pathPrefix, filePath)
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        const file = esm ? `export const handler = ${handler.toString()}` : `exports.handler = ${handler.toString()}`
        await writeFile(dest, file)
      })
      return builder
    },
    withEdgeFunction: ({ handler, name = 'function', pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, 'netlify/edge-functions', `${name}.js`)
      tasks.push(async () => {
        const content = `export default ${handler.toString()}`
        await ensureDir(path.dirname(dest))
        await writeFile(dest, content)
      })
      return builder
    },
    withRedirectsFile: ({ redirects = [], pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, '_redirects')
      tasks.push(async () => {
        const content = redirects
          .map(({ condition = '', from, status, to }) => [from, to, status, condition].filter(Boolean).join(' '))
          .join(os.EOL)
        await ensureDir(path.dirname(dest))
        await writeFile(dest, content)
      })
      return builder
    },
    withHeadersFile: ({ headers = [], pathPrefix = '' }) => {
      const dest = path.join(directory, pathPrefix, '_headers')
      tasks.push(async () => {
        const content = headers
          .map(
            ({ headers: headersValues, path: headerPath }) =>
              `${headerPath}${os.EOL}${headersValues.map((header) => `  ${header}`).join(`${os.EOL}`)}`,
          )
          .join(os.EOL)
        await ensureDir(path.dirname(dest))
        await writeFile(dest, content)
      })
      return builder
    },
    withContentFile: ({ content, path: filePath }) => {
      const dest = path.join(directory, filePath)
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await writeFile(dest, content)
      })
      return builder
    },
    withCopiedFile: ({ path: filePath, src }) => {
      const dest = path.join(directory, filePath)
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await copyFile(src, dest)
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
        await writeFile(
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
        await unlink(dest)
      })
      return builder
    },
    withBuildPlugin: ({ name, pathPrefix = 'plugins', plugin }) => {
      const dest = path.join(directory, pathPrefix, `${name}.js`)
      tasks.push(async () => {
        await ensureDir(path.dirname(dest))
        await Promise.all([
          writeFile(path.join(directory, pathPrefix, 'manifest.yml'), `name: ${name}`),
          writeFile(dest, `module.exports = ${serializeJS(plugin)}`),
        ])
      })
      return builder
    },
    buildAsync: async () => {
      // eslint-disable-next-line fp/no-loops
      for (const task of tasks) {
        await task()
      }

      tasks = []

      return builder
    },
    cleanupAsync: async () => {
      await rmdirRecursiveAsync(directory).catch((error) => {
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
