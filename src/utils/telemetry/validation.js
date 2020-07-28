/**
 * Utility to validating analytic event names for clean data
 */

module.exports = function isValidEventName(eventName, config) {
  const validProject = [config.projectName] || []
  const validObjects = config.objects || []
  const matches = eventName.match(/([a-zA-Z]*):([a-zA-Z]*)_([a-zA-Z]*$)/)
  if (!containsSeparators(eventName) || !matches) {
    return formattingWarning(eventName)
  }
  const project = matches[1]
  const object = matches[2]
  const action = matches[3]
  let error
  // if missing any parts of event, exit
  if (!project || !object || !action) {
    return formattingWarning(eventName)
  }
  // validate project name
  if (validProject.indexOf(project) === -1) {
    error = `> "${project}" is invalid tracking project. Must be one of ${JSON.stringify(validProject)}`
    return formattingWarning(eventName, error)
  }
  // validate object name
  if (validObjects.indexOf(object) === -1) {
    error = `> "${object}" is invalid tracking object. Must be one of ${JSON.stringify(validObjects)}`
    return formattingWarning(eventName, error)
  }
  return true
}

function containsSeparators(eventName) {
  const underscores = (eventName.match(/_/g) || []).length
  if (underscores !== 1) {
    console.log(`Event name must have single underscore. "${eventName}" contains ${underscores}`)
    return false
  }
  const colons = (eventName.match(/:/g) || []).length
  if (colons !== 1) {
    console.log(`Event name must have single colon. "${eventName}" contains ${colons}`)
    return false
  }
  return true
}

function formattingWarning(eventName, errorMsg) {
  console.log('-----------------------------')
  console.log('Tracking Error:')
  console.log(`Incorrect tracking event format: "${eventName}"`)
  if (errorMsg) {
    console.log(errorMsg)
  }
  console.log('-----------------------------')
  console.log(`Formatting information: `)
  console.log(`eventName must match 'cli:objectName_actionName'`)
  console.log(`eventName must be camelCased: 'camelCase:camelCase_camelCase'`)
  console.log(`Example: cli:sites_deploySucceeded`)
  console.log('-----------------------------')
  return false
}
