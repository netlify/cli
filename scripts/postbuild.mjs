import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const cwd = path.dirname(fileURLToPath(import.meta.url))

const srcPath = path.resolve(cwd, '../src/lib/templates')
const destPath = path.resolve(cwd, '../dist/lib/templates')

fs.cpSync(srcPath, destPath, { recursive: true })
