// @ts-check
const { copyFile, mkdir, rm, symlink, unlink, writeFile } = require('fs').promises
const os = require('os')
const path = require('path')
const process = require('process')

const execa = require('execa')
const serializeJS = require('serialize-javascript')
const tempDirectory = require('temp-dir')
const { toToml } = require('tomlify-j0.4')
const { v4: uuidv4 } = require('uuid')

const ensureDir = (file) => mkdir(file, { recursive: true })

class SiteBuilder {
  directory
  tasks = []

  constructor(directory) {
    this.directory = directory
  }

  ensureDirectoryExists(directory) {
    this.tasks.push(async () => ensureDir(directory))

    return this
  }

  withNetlifyToml({ config, pathPrefix = '' }) {
    const dest = path.join(this.directory, pathPrefix, 'netlify.toml')
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

    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      await writeFile(dest, content)
    })

    return this
  }

  withStateFile({ siteId = '' }) {
    const dest = path.join(this.directory, '.netlify', 'state.json')
    this.tasks.push(async () => {
      const content = `{ "siteId" : "${siteId}" }`
      await ensureDir(path.dirname(dest))
      await writeFile(dest, content)
    })
    return this
  }

  withPackageJson({ packageJson, pathPrefix = '' }) {
    const dest = path.join(this.directory, pathPrefix, 'package.json')
    this.tasks.push(async () => {
      const content = JSON.stringify(packageJson, null, 2)
      await ensureDir(path.dirname(dest))
      await writeFile(dest, `${content}\n`)
    })

    return this
  }

  withFunction({ esm = false, handler, path: filePath, pathPrefix = 'functions' }) {
    const dest = path.join(this.directory, pathPrefix, filePath)
    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      const file = esm ? `export const handler = ${handler.toString()}` : `exports.handler = ${handler.toString()}`
      await writeFile(dest, file)
    })

    return this
  }

  /**
   *
   * @param {{config?:any, handler:any, internal?:boolean, name?:string, pathPrefix?:string}} param0
   * @returns
   */
  withEdgeFunction({ config, handler, internal = false, name = 'function', pathPrefix = '' }) {
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

  withRedirectsFile({ pathPrefix = '', redirects = [] }) {
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

  withHeadersFile({ headers = [], pathPrefix = '' }) {
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

  withContentFile({ content, path: filePath }) {
    const dest = path.join(this.directory, filePath)
    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      await writeFile(dest, content)
    })

    return this
  }

  withCopiedFile({ path: filePath, src }) {
    const dest = path.join(this.directory, filePath)
    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      await copyFile(src, dest)
    })

    return this
  }

  withContentFiles(files) {
    files.forEach((file) => {
      this.withContentFile(file)
    })

    return this
  }

  withEnvFile({ env = {}, path: filePath = '.env', pathPrefix = '' }) {
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

  withGit({ repoUrl = 'git@github.com:owner/repo.git' } = {}) {
    this.tasks.push(async () => {
      await execa('git', ['init', '--initial-branch', 'main'], { cwd: this.directory })
      await execa('git', ['remote', 'add', 'origin', repoUrl], { cwd: this.directory })
    })

    return this
  }

  withoutFile({ path: filePath }) {
    const dest = path.join(this.directory, filePath)
    this.tasks.push(async () => {
      await unlink(dest)
    })

    return this
  }

  withBuildPlugin({ name, pathPrefix = 'plugins', plugin }) {
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

  withSymlink({ path: symlinkPath, target }) {
    const dest = path.join(this.directory, symlinkPath)

    this.tasks.push(async () => {
      await ensureDir(path.dirname(dest))
      await symlink(path.join(this.directory, target), path.join(this.directory, symlinkPath))
    })

    return this
  }

  async build() {
    // eslint-disable-next-line fp/no-loops
    for (const task of this.tasks) {
      await task()
    }

    this.tasks = []

    return this
  }

  /**
   * @deprecated
   */
  async buildAsync() {
    return this.build()
  }

  async cleanup() {
    try {
      await rm(this.directory, { force: true, recursive: true })
    } catch (error) {
      console.warn(error)
    }

    return this
  }

  /**
   * @deprecated
   */
  async cleanupAsync() {
    return this.cleanup()
  }
}

const createSiteBuilder = ({ siteName }) => {
  const directory = path.join(
    tempDirectory,
    `netlify-cli-tests-${process.version}`,
    `${process.pid}`,
    uuidv4(),
    siteName,
  )

  return new SiteBuilder(directory).ensureDirectoryExists(directory)
}

const withSiteBuilder = async (siteName, testHandler) => {
  let builder
  try {
    builder = createSiteBuilder({ siteName })
    return await testHandler(builder)
  } finally {
    if (builder) await builder.cleanup()
  }
}

module.exports = { createSiteBuilder, SiteBuilder, withSiteBuilder }
