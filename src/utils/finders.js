const path = require('path')
const fs = require('fs')
const packList = require('npm-packlist')
const precinct = require('precinct')
const resolve = require('resolve')
const readPkgUp = require('read-pkg-up')
const requirePackageName = require('require-package-name')
const alwaysIgnored = new Set(['aws-sdk'])
const debug = require('debug')('netlify-dev-plugin:src/utils/finders')

const ignoredExtensions = new Set([
  '.log',
  '.lock',
  '.html',
  '.md',
  '.map',
  '.ts',
  '.png',
  '.jpeg',
  '.jpg',
  '.gif',
  '.css',
  '.patch',
])

function ignoreMissing(dependency, optional) {
  return alwaysIgnored.has(dependency) || (optional && dependency in optional)
}

function includeModuleFile(packageJson, moduleFilePath) {
  if (packageJson.files) {
    return true
  }

  return !ignoredExtensions.has(path.extname(moduleFilePath))
}

function getDependencies(filename, basedir) {
  const servicePath = basedir

  const filePaths = new Set()
  const modulePaths = new Set()
  const pkgs = {}

  const modulesToProcess = []
  const localFilesToProcess = [filename]

  function handle(name, basedir, optionalDependencies) {
    const moduleName = requirePackageName(name.replace(/\\/g, '/'))

    if (alwaysIgnored.has(moduleName)) {
      return
    }

    try {
      const pathToModule = resolve.sync(path.join(moduleName, 'package.json'), {
        basedir,
      })
      const pkg = readPkgUp.sync({ cwd: pathToModule })

      if (pkg) {
        modulesToProcess.push(pkg)
      }
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        if (ignoreMissing(moduleName, optionalDependencies)) {
          debug(`WARNING missing optional dependency: ${moduleName}`)
          return null
        }
        try {
          // this resolves the requested import also against any set up NODE_PATH extensions, etc.
          const resolved = require.resolve(name)
          localFilesToProcess.push(resolved)
          return
        } catch (e) {
          throw new Error(`Could not find "${moduleName}" module in file: ${filename.replace(
            path.dirname(basedir),
            ''
          )}. 
          
Please ensure "${moduleName}" is installed in the project.`)
        }
      }
      throw e
    }
  }

  while (localFilesToProcess.length) {
    const currentLocalFile = localFilesToProcess.pop()

    if (filePaths.has(currentLocalFile)) {
      continue
    }

    filePaths.add(currentLocalFile)
    precinct.paperwork(currentLocalFile, { includeCore: false }).forEach(dependency => {
      if (dependency.indexOf('.') === 0) {
        const abs = resolve.sync(dependency, {
          basedir: path.dirname(currentLocalFile),
        })
        localFilesToProcess.push(abs)
      } else {
        handle(dependency, servicePath)
      }
    })
  }

  while (modulesToProcess.length) {
    const currentModule = modulesToProcess.pop()
    const currentModulePath = path.join(currentModule.path, '..')
    const packageJson = currentModule.pkg

    if (modulePaths.has(currentModulePath)) {
      continue
    }
    modulePaths.add(currentModulePath)
    pkgs[currentModulePath] = packageJson
    ;['dependencies', 'peerDependencies', 'optionalDependencies'].forEach(key => {
      const dependencies = packageJson[key]

      if (dependencies) {
        Object.keys(dependencies).forEach(dependency => {
          handle(dependency, currentModulePath, packageJson.optionalDependencies)
        })
      }
    })
  }

  modulePaths.forEach(modulePath => {
    const packageJson = pkgs[modulePath]
    let moduleFilePaths

    moduleFilePaths = packList.sync({ path: modulePath })

    moduleFilePaths.forEach(moduleFilePath => {
      if (includeModuleFile(packageJson, moduleFilePath)) {
        filePaths.add(path.join(modulePath, moduleFilePath))
      }
    })
  })

  // TODO: get rid of this
  const sizes = {}
  filePaths.forEach(filepath => {
    const stat = fs.lstatSync(filepath)
    const ext = path.extname(filepath)
    sizes[ext] = (sizes[ext] || 0) + stat.size
  })
  debug('Sizes per extension: ', sizes)

  return [...filePaths]
}

function findModuleDir(dir) {
  let basedir = dir
  while (!fs.existsSync(path.join(basedir, 'package.json'))) {
    const newBasedir = path.dirname(basedir)
    if (newBasedir === basedir) {
      return null
    }
    basedir = newBasedir
  }
  return basedir
}

function findHandler(functionPath) {
  if (fs.lstatSync(functionPath).isFile()) {
    return functionPath
  }

  const handlerPath = path.join(functionPath, `${path.basename(functionPath)}.js`)
  if (!fs.existsSync(handlerPath)) {
    return
  }
  return handlerPath
}

module.exports = { getDependencies, findModuleDir, findHandler }
