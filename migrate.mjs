import fs, { readFileSync, renameSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import path, { dirname, join } from 'path'

import glob from 'glob'
// const require = createRequire(import.meta.url)
// const pathName = require.resolve('@netlify/plugin-edge-handlers')

// console.log(new URL('../../lib/completion/script.js', import.meta.url).pathname)

// join(import.meta.resolve('@netlify/plugin-edge-handlers'))

// const { name, version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url).pathname, 'utf-8'))

// const templatesDir = new URL('src/functions-templates', import.meta.url).pathname
// const lang = 'javascript'

// const folderNames = fs.readdirSync(path.join(templatesDir, lang))
// let registry = folderNames
//   .filter((folderName) => !folderName.endsWith('.md'))
//   .map((folderName) => path.join(templatesDir, lang, folderName, '.netlify-function-template.js'))
//   // eslint-disable-next-line promise/prefer-await-to-then
//   .map((pa) => import(pa).then(({config}) => config))

// registry = await Promise.all(registry)

glob.sync('src/functions-templates/javascript/**/.netlify-function-template.mjs').forEach(file => {
  console.log(file)
  const folder = dirname(file);

  const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf-8'))

  pkg.type = 'module'

  writeFileSync(join(folder, 'package.json'), JSON.stringify(pkg, null, 2))

  renameSync(file, file.replace('.mjs', '.js'))

})

// console.log(registry)
