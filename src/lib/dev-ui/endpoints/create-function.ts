import { promises as fs } from 'fs'
import path from 'path'

import { parse as parseContentType } from 'content-type'
import { Request as ExpressRequest, Response as ExpressResponse } from 'express'
import multiparty from 'multiparty'

import { chalk, isNodeError, log, NETLIFYDEVLOG } from '../../../utils/command-helpers.js'
import { parseForm } from '../../../utils/parse-form.js'
import { UIContext } from '../context.js'

/**
 * Checks whether the incoming path corresponds to an existing file or returns
 * a variation of that path that does not match an existing file.
 * For example, sending `/path/foo.js` as input will return `/path/foo.js` if
 * that path is availablem or `/path/foo-1.js` if not. The suffix will keep
 * incrementing until an available path is found.
 */
const getAvailableFilename = async (originalPath: path.ParsedPath, suffix = 0): Promise<string> => {
  const newPath = { ...originalPath }

  if (suffix > 0) {
    newPath.name = `${originalPath.name}-${suffix}`
    newPath.base = newPath.name + originalPath.ext
  }

  const fullPath = path.format(newPath)

  try {
    await fs.stat(fullPath)

    throw new Error('File already exists')
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return fullPath
    }

    return getAvailableFilename(originalPath, suffix + 1)
  }
}

export const handleCreateFunction = async (context: UIContext, req: ExpressRequest, res: ExpressResponse) => {
  const contentType = parseContentType(req)
  const form = new multiparty.Form({ encoding: contentType.parameters.charset ?? 'utf8' })

  try {
    const { fields, files } = await parseForm(req, form)
    const fileName = fields?.path[0]
    const notes = fields?.notes ?? []

    if (!fileName) {
      throw new Error("Missing 'path' field")
    }

    const file = files.get('function')

    if (!file) {
      throw new Error("Missing 'function' file")
    }

    const basePath = context.config.functionsDirectory ?? path.join(context.projectDir, 'netlify/functions')

    await fs.mkdir(basePath, { recursive: true })

    const fullPath = await getAvailableFilename(path.parse(path.join(basePath, fileName)))

    await fs.rename(file.path, fullPath)

    const message = [`${NETLIFYDEVLOG} Created function ${chalk.yellow(path.basename(fullPath))} in the UI`]

    notes.forEach((note) => {
      message.push(`  - ${note}`)
    })

    log(message.join('\n'))

    res.status(202).end()
  } catch (error: unknown) {
    const message = isNodeError(error) ? error.message : ''

    res.status(500).send(`Could not parse request: ${message}`)
  }
}
