import { promises as fs } from 'fs'
import path from 'path'

import { parse as parseContentType } from 'content-type'
import { Request as ExpressRequest, Response as ExpressResponse } from 'express'
import multiparty from 'multiparty'

import { chalk, isNodeError, log, NETLIFYDEVLOG } from '../../../utils/command-helpers.js'
import { launchEditor } from '../../../utils/launch-editor.js'
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

interface FunctionType {
  basePath: string
  name: string
}

const getFunctionType = (context: UIContext, typeField?: string[]): FunctionType => {
  const [typeFieldValue = 'serverless'] = typeField ?? []

  switch (typeFieldValue) {
    case 'edge':
      return {
        // @ts-expect-error TODO: add type for `build.edge_functions`
        basePath: context.config.build.edge_functions ?? path.join(context.projectDir, 'netlify/edge-functions'),
        name: 'edge function',
      }

    case 'serverless':
      return {
        basePath: context.config.functionsDirectory ?? path.join(context.projectDir, 'netlify/functions'),
        name: 'function',
      }

    default:
      throw new Error(`${typeFieldValue} is not a supported function type`)
  }
}

export const handleCreateFunction = async (context: UIContext, req: ExpressRequest, res: ExpressResponse) => {
  const contentType = parseContentType(req)
  const form = new multiparty.Form({ encoding: contentType.parameters.charset ?? 'utf8' })

  try {
    const { fields, files } = await parseForm(req, form)
    const fileName = fields?.path?.[0]
    const notes = fields?.notes ?? []
    const shouldLaunchEditor = fields?.launchEditor?.[0] === 'true'

    if (!fileName) {
      throw new Error("Missing 'path' field")
    }

    const file = files.get('function')

    if (!file) {
      throw new Error("Missing 'function' file")
    }

    const type = getFunctionType(context, fields.type)

    await fs.mkdir(type.basePath, { recursive: true })

    const fullPath = await getAvailableFilename(path.parse(path.join(type.basePath, fileName)))
    const baseName = path.basename(fullPath)

    await fs.rename(file.path, fullPath)

    const message = [`${NETLIFYDEVLOG} Created ${type.name} ${chalk.yellow(baseName)} in the UI`]

    notes.forEach((note) => {
      message.push(`  - ${note}`)
    })

    log(message.join('\n'))

    if (shouldLaunchEditor) {
      log(`${NETLIFYDEVLOG} Opening ${baseName} in editor...`)
      launchEditor(fullPath)
    }

    res.status(202).json({ filename: fullPath })
  } catch (error: unknown) {
    const message = isNodeError(error) ? error.message : ''

    res.status(500).send(`Could not parse request: ${message}`)
  }
}
