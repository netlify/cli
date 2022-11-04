// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readFile'.
const { readFile } = require('fs').promises
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'join'.
const { join } = require('path')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
let errorTemplateFile: $TSFixMe

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'renderErro... Remove this comment to see the full error message
const renderErrorTemplate = async (errString: $TSFixMe, templatePath: $TSFixMe, functionType: $TSFixMe) => {
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
