import http from 'http'

import multiparty, { File } from 'multiparty'

interface FormResult {
  fields: Record<string, string[]>
  files: Map<string, File>
}

/**
 * Parses a multipart/form-data request and returns an object with all fields
 * and files found.
 */
export const parseForm = (req: http.IncomingMessage, form: multiparty.Form) => {
  const finalFields = new Map<string, File>()

  return new Promise<FormResult>((resolve, reject) => {
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    form.parse(req, (err, fields, files: Record<string, File[]>) => {
      if (err) {
        return reject(err)
      }

      Object.entries(files).forEach(([name, file]) => {
        if (file.length === 0) {
          return
        }

        finalFields.set(name, file[0])
      })

      return resolve({ fields, files: finalFields })
    })
  })
}
