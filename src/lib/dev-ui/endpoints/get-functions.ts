import { readdir } from 'fs/promises'
import path, {dirname} from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

import { Request as ExpressRequest, Response as ExpressResponse } from 'express'


const languages = ['javascript', 'typescript', 'go']

interface Template {
  name: string,
  description: string,
  type: 'serverless' | 'edge',
  language: string
}

export const getFunctions = async (_: ExpressRequest, res: ExpressResponse) => {

  const templates: Template[] = []

  const templatesDir = path.resolve(dirname(fileURLToPath(import.meta.url)), '../../../functions-templates')

  for (const id in languages) {
const folders = await readdir(path.join(templatesDir, languages[id]), { withFileTypes: true })

    const imports = await Promise.all(
      folders
        .filter((folder) => Boolean(folder?.isDirectory()))
        .map(async ({ name }) => {
          try {
            const templatePath = path.join(templatesDir, languages[id], name, '.netlify-function-template.js')
            // @ts-expect-error TS(7036) FIXME: Dynamic import's specifier must be of type 'string... Remove this comment to see the full error message
            const template = await import(pathToFileURL(templatePath))
            return template.default
          } catch  {}
        }),
    )

    const registry = imports
      .filter((template) => Boolean(template))
      .sort((templateA, templateB) => {
        const DEFAULT_PRIORITY = 999
        const priorityDiff = (templateA.priority || DEFAULT_PRIORITY) - (templateB.priority || DEFAULT_PRIORITY)

        if (priorityDiff !== 0) {
          return priorityDiff
        }

        return templateA - templateB
      })
      .map((t) => ({
          name: t.name,
          description: t.description,
          type: t.functionType,
          language: languages[id]
        }))

    templates.push(...registry)

  }

  res.json({ templates })
}
