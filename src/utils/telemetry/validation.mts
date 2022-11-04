/**
 * Utility to validating analytic event names for clean data
 */

const { log } = require('../command-helpers.mjs')


export function isValidEventName(eventName: $TSFixMe, config: $TSFixMe) {
  const validProject = [config.projectName]
  const validObjects = config.objects || []
  const matches = eventName.match(/([a-zA-Z]*):([a-zA-Z]*)_([a-zA-Z]*$)/)
  if (!containsSeparators(eventName) || !matches) {
    // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
    return formattingWarning(eventName)
  }
  const [, project, object, action] = matches
  let error
  // if missing any parts of event, exit
  if (!project || !object || !action) {
    // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
    return formattingWarning(eventName)
  }
  // validate project name
  if (!validProject.includes(project)) {
    error = `> "${project}" is invalid tracking project. Must be one of ${JSON.stringify(validProject)}`
    return formattingWarning(eventName, error)
  }
  // validate object name
  if (!validObjects.includes(object)) {
    error = `> "${object}" is invalid tracking object. Must be one of ${JSON.stringify(validObjects)}`
    return formattingWarning(eventName, error)
  }
  return true
}


const containsSeparators = function (eventName: $TSFixMe) {
  const underscores = (eventName.match(/_/g) || []).length
  if (underscores !== 1) {
    log(`Event name must have single underscore. "${eventName}" contains ${underscores}`)
    return false
  }
  const colons = (eventName.match(/:/g) || []).length
  if (colons !== 1) {
    log(`Event name must have single colon. "${eventName}" contains ${colons}`)
    return false
  }
  return true
}


const formattingWarning = function (eventName: $TSFixMe, errorMsg: $TSFixMe) {
  log('-----------------------------')
  log('Tracking Error:')
  log(`Incorrect tracking event format: "${eventName}"`)
  if (errorMsg) {
    log(errorMsg)
  }
  log('-----------------------------')
  log(`Formatting information: `)
  log(`eventName must match 'cli:objectName_actionName'`)
  log(`eventName must be camelCased: 'camelCase:camelCase_camelCase'`)
  log(`Example: cli:sites_deploySucceeded`)
  log('-----------------------------')
  return false
}
