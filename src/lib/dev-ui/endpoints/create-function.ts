import { promises as fs } from 'fs'
import path from 'path'

import { parse as parseContentType } from 'content-type'
import { Request as ExpressRequest, Response as ExpressResponse } from 'express'
import multiparty from 'multiparty'

import { isNodeError } from '../../../utils/command-helpers.js'
import { parseForm } from '../../../utils/parse-form.js'
import { UIContext } from '../context.js'

export const handleCreateFunction = async (context: UIContext, req: ExpressRequest, res: ExpressResponse) => {
  const contentType = parseContentType(req)
  const form = new multiparty.Form({ encoding: contentType.parameters.charset ?? 'utf8' })

  try {
    const { fields, files } = await parseForm(req, form)
    const fileName = fields?.path[0]

    if (!fileName) {
      throw new Error("Missing 'path' field")
    }

    const file = files.get('function')

    if (!file) {
      throw new Error("Missing 'function' file")
    }

    const basePath = context.config.functionsDirectory ?? path.join(context.projectDir, 'netlify/functions')

    await fs.mkdir(basePath, { recursive: true })

    const fullPath = path.join(basePath, fileName)

    await fs.rename(file.path, fullPath)

    res.status(202).end()
  } catch (error: unknown) {
    const message = isNodeError(error) ? error.message : ''

    res.status(500).send(`Could not parse request: ${message}`)
  }
}
