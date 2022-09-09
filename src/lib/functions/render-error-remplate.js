const { readFile } = require('fs').promises
const { join } = require('path')

let errorTemplateFile

const renderErrorTemplate = async (errString) => {
  const regexPattern = /<!--@ERROR-DETAILS-->/g
  const templatePath = './templates/function-error.html'

  try {
    errorTemplateFile = errorTemplateFile || (await readFile(join(__dirname, templatePath), 'utf-8'))
    return errorTemplateFile.replace(regexPattern, errString)
  } catch {
    return errString
  }
}

module.exports = renderErrorTemplate
