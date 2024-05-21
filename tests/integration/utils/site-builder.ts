import { copyFile, mkdir, rm, unlink, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import process from 'process'

import slugify from '@sindresorhus/slugify'
import { execa } from 'execa'
import serializeJS from 'serialize-javascript'
import tempDirectory from 'temp-dir'
import tomlify from 'tomlify-j0.4'
import { v4 as uuidv4 } from 'uuid'
import type { TaskContext } from 'vitest'

const ensureDir = (directory: string) => mkdir(directory, { recursive: true })

type Task = () => Promise<unknown>

export class SiteBuilder {
  tasks: Task[] = []

  // eslint-disable-next-line no-useless-constructor
  constructor(public readonly directory: string) {}

  ensureDirectoryExists(directory: string) {
    this.tasks.push(async () => ensureDir(directory))

    return this
  }

  withNetlifyToml({ config, pathPrefix = '' }) {
    const dest = path.join(this.directory, pathPrefix, 'netlify.toml')
    const content = tomlify.toToml(config, {
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

    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      await writeFile(dest, content)
    })

    return this
  }

  withStateFile({ siteId = '' }: { siteId?: string }) {
    const dest = path.join(this.directory, '.netlify', 'state.json')
    this.tasks.push(async () => {
      const content = `{ "siteId" : "${siteId}" }`
      await ensureDir(path.dirname(dest))
      await writeFile(dest, content)
    })
    return this
  }

  withPackageJson({ packageJson, pathPrefix = '' }: { packageJson: any; pathPrefix?: string }) {
    const dest = path.join(this.directory, pathPrefix, 'package.json')
    this.tasks.push(async () => {
      const content = JSON.stringify(packageJson, null, 2)
      await ensureDir(path.dirname(dest))
      await writeFile(dest, `${content}\n`)
    })

    return this
  }

  withFunction({
    esm = false,
    handler,
    path: filePath,
    pathPrefix = 'functions',
  }: {
    esm?: boolean
    handler: any
    path: string
    pathPrefix?: string
  }) {
    const dest = path.join(this.directory, pathPrefix, filePath)
    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      const file = esm ? `export const handler = ${handler.toString()}` : `exports.handler = ${handler.toString()}`
      await writeFile(dest, file)
    })

    return this
  }

  withEdgeFunction({
    config,
    handler,
    internal = false,
    name = 'function',
    pathPrefix = '',
  }: {
    config?: any
    handler: string | Function
    internal?: boolean
    name?: string
    pathPrefix?: string
  }) {
    const edgeFunctionsDirectory = internal ? '.netlify/edge-functions' : 'netlify/edge-functions'
    const dest = path.join(this.directory, pathPrefix, edgeFunctionsDirectory, `${name}.js`)
    this.tasks.push(async () => {
      let content = typeof handler === 'string' ? handler : `export default ${handler.toString()}`

      if (config) {
        content += `;export const config = ${JSON.stringify(config)}`
      }

      await ensureDir(path.dirname(dest))
      await writeFile(dest, content)
    })

    return this
  }

  withRedirectsFile({ pathPrefix = '', redirects = [] }: { pathPrefix?: string; redirects?: any[] }) {
    const dest = path.join(this.directory, pathPrefix, '_redirects')
    this.tasks.push(async () => {
      const content = redirects
        .map(({ condition = '', from, status, to }) => [from, to, status, condition].filter(Boolean).join(' '))
        .join(os.EOL)
      await ensureDir(path.dirname(dest))
      await writeFile(dest, content)
    })

    return this
  }

  withHeadersFile({
    headers = [],
    pathPrefix = '',
  }: {
    headers?: { headers: string[]; path: string }[]
    pathPrefix?: string
  }) {
    const dest = path.join(this.directory, pathPrefix, '_headers')
    this.tasks.push(async () => {
      const content = headers
        .map(
          ({ headers: headersValues, path: headerPath }) =>
            `${headerPath}${os.EOL}${headersValues.map((header) => `  ${header}`).join(`${os.EOL}`)}`,
        )
        .join(os.EOL)
      await ensureDir(path.dirname(dest))
      await writeFile(dest, content)
    })

    return this
  }

  withContentFile({ content, path: filePath }: { content: string; path: string }) {
    const dest = path.join(this.directory, filePath)
    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      await writeFile(dest, content)
    })

    return this
  }

  withCopiedFile({ path: filePath, src }: { path: string; src: string }) {
    const dest = path.join(this.directory, filePath)
    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      await copyFile(src, dest)
    })

    return this
  }

  withContentFiles(files: { content: string; path: string }[]) {
    files.forEach((file) => {
      this.withContentFile(file)
    })

    return this
  }

  withEnvFile({
    env = {},
    path: filePath = '.env',
    pathPrefix = '',
  }: {
    env?: any
    path?: string
    pathPrefix?: string
  }) {
    const dest = path.join(this.directory, pathPrefix, filePath)
    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      await writeFile(
        dest,
        Object.entries(env)
          .map(([key, value]) => `${key}=${value}`)
          .join(os.EOL),
      )
    })
    return this
  }

  withGit({ repoUrl = 'git@github.com:owner/repo.git' }: { repoUrl?: string } = {}) {
    this.tasks.push(async () => {
      await execa('git', ['init', '--initial-branch', 'main'], { cwd: this.directory })
      await execa('git', ['remote', 'add', 'origin', repoUrl], { cwd: this.directory })
    })

    return this
  }

  withoutFile({ path: filePath }: { path: string }) {
    const dest = path.join(this.directory, filePath)
    this.tasks.push(async () => {
      await unlink(dest)
    })

    return this
  }

  withBuildPlugin({ name, pathPrefix = 'plugins', plugin }: { name: string; pathPrefix?: string; plugin: any }) {
    const dest = path.join(this.directory, pathPrefix, `${name}.js`)
    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      await Promise.all([
        writeFile(path.join(this.directory, pathPrefix, 'manifest.yml'), `name: ${name}`),
        writeFile(dest, `module.exports = ${serializeJS(plugin)}`),
      ])
    })

    return this
  }

  withCommand({ command }: { command: string[] }) {
    this.tasks.push(async () => {
      const [mainCommand, ...args] = command

      await execa(mainCommand, args, { cwd: this.directory })
    })

    return this
  }

  async build() {
    for (const task of this.tasks) {
      await task()
    }

    this.tasks = []

    return this
  }

  async cleanup() {
    try {
      await rm(this.directory, { force: true, recursive: true })
    } catch (error) {
      console.warn(error)
    }

    return this
  }
}

export const createSiteBuilder = ({ siteName }: { siteName: string }) => {
  const directory = path.join(
    tempDirectory,
    `netlify-cli-tests-${process.version}`,
    `${process.pid}`,
    uuidv4(),
    siteName,
  )

  return new SiteBuilder(directory).ensureDirectoryExists(directory)
}

/**
 * @param taskContext used to infer directory name from test name
 */
export async function withSiteBuilder<T>(
  taskContext: TaskContext,
  testHandler: (builder: SiteBuilder) => Promise<T>,
): Promise<T> {
  let builder: SiteBuilder | undefined
  try {
    builder = createSiteBuilder({ siteName: slugify(taskContext.task.name) })
    return await testHandler(builder)
  } finally {
    if (builder) await builder.cleanup()
  }
}
