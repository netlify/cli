// @ts-check

const AsciiTable = require('ascii-table')


const { chalk } = require('../command-helpers.cjs')


const missingValues = function (values: $TSFixMe, manifest: $TSFixMe) {
  const display = values
    
    .map((item: $TSFixMe) => {
      const itemDisplay = chalk.redBright.bold(`${item}`)
      const niceNameDisplay = manifest.config[item].displayName
      return ` - ${itemDisplay} ${niceNameDisplay}`
    })
    .join('\n')
  console.log(display)
}


const configValues = function (addonName: $TSFixMe, values: $TSFixMe, currentValue: $TSFixMe) {
  const table = new AsciiTable(`${addonName} add-on settings`)

  const tableHeader = currentValue
    ? ['Setting Name', 'Current Value', 'Description']
    : ['Setting Name', 'Description', 'Type', 'Required']

  table.setHeading(...tableHeader)

  Object.keys(values).forEach((key) => {
    const { displayName, required, type } = values[key]
    const requiredText = required ? `true` : `false`
    const typeInfo = type || ''
    const description = displayName || ''
    if (currentValue) {
      const value = currentValue[key] || 'Not supplied'
      table.addRow(key, value, description)
    } else {
      table.addRow(key, description, typeInfo, requiredText)
    }
  })
  console.log(table.toString())
}

module.exports = {
  missingValues,
  configValues,
}
