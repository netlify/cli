
const { readFile } = require('fs').promises

const { join } = require('path')


let errorTemplateFile: $TSFixMe


export const renderErrorTemplate = async (errString: $TSFixMe, templatePath: $TSFixMe, functionType: $TSFixMe) => {
  const errorDetailsRegex = /<!--@ERROR-DETAILS-->/g
  const functionTypeRegex = /<!--@FUNCTION-TYPE-->/g
  try {
    errorTemplateFile = errorTemplateFile || (await readFile(join(__dirname, templatePath), 'utf-8'))
    return errorTemplateFile.replace(errorDetailsRegex, errString).replace(functionTypeRegex, functionType)
  } catch {
    return errString
  }
}
