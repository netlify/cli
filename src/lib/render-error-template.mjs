import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

let errorTemplateFile
const dir = dirname(fileURLToPath(import.meta.url))

const renderErrorTemplate = async (errString, templatePath, functionType) => {
  const errorDetailsRegex = /<!--@ERROR-DETAILS-->/g
  const functionTypeRegex = /<!--@FUNCTION-TYPE-->/g

  try {
    errorTemplateFile = errorTemplateFile || (await readFile(join(dir, templatePath), 'utf-8'))

    return errorTemplateFile.replace(errorDetailsRegex, errString).replace(functionTypeRegex, functionType)
  } catch {
    return errString
  }
}

export default renderErrorTemplate
