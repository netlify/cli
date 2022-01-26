// @ts-check
import { promises } from 'fs'
import os from 'os'
import path from 'path'
import process from 'process'

import { execa } from 'execa'
import serializeJS from 'serialize-javascript'
import tempDirectory from 'temp-dir'
import toml from 'tomlify-j0.4'
import { v4 as uuidv4 } from 'uuid'

import { rmdirRecursiveAsync } from '../../src/lib/fs.js'

const { copyFile, mkdir, unlink, writeFile } = promises

const ensureDir = (file) => mkdir(file, { recursive: true })

export const createSiteBuilder = ({ siteName }) => {
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
      const content = toml.toToml(config, {
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
    withEdgeHandlers: ({ fileName = 'index.js', handlers }) => {
      const dest = path.join(directory, 'netlify/edge-handlers', fileName)
      tasks.push(async () => {
        const content = Object.entries(handlers)
          .map(([event, handler]) => `export const ${event} = ${handler.toString()}`)
          .join(os.EOL)
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

export const withSiteBuilder = async (siteName, testHandler) => {
  let builder
  try {
    builder = createSiteBuilder({ siteName })
    return await testHandler(builder)
  } finally {
    await builder.cleanupAsync()
  }
}
