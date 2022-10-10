const { readFile } = require('fs').promises
const { join } = require('path')

let errorTemplateFile

const renderErrorTemplate = async (errString, templatePath, functionType) => {
  const errorDetailsRegex = /<!--@ERROR-DETAILS-->/g
  const functionTypeRegex = /<!--@FUNCTION-TYPE-->/g
  try {
    errorTemplateFile = errorTemplateFile || (await readFile(join(__dirname, templatePath), 'utf-8'))
    return errorTemplateFile.replace(errorDetailsRegex, errString).replace(functionTypeRegex, functionType)
  } catch {
    return errString
  }
}

module.exports = renderErrorTemplate
