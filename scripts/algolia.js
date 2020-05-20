/**
 * Create algolia index from contents
 */
const algoliaSearch = require('algoliasearch')
const generateCommandData = require('./generateCommandData')

// Disable chalk output on command values
process.env.DOCS_GEN = 'TRUE'

// Algolia Values
const algoliaApplicationID = 'LBLPR1R7ZZ'
const algoliaIndexName = 'cli-docs'
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY
const algoliaClient = algoliaSearch(algoliaApplicationID, ALGOLIA_API_KEY)

// Get CLI command data
const commandData = generateCommandData()

const flattenedData = Object.keys(commandData).reduce((acc, curr) => {
  const command = commandData[curr]
  if (command.commands.length) {
    const subCommands = command.commands.reduce((a, c) => {
      console.log('c', c)
      a[c.name] = c
      return a
    }, {})
    //const subCommands = getCommandData(commandData)
    console.log('subCommands', subCommands)
    console.log('has sub commands', curr)
    acc = Object.assign({}, acc, subCommands)
  }
  delete command.command

  acc[curr] = command

  return acc
}, {})

/*
function getCommandData(commandData) {
  return Object.keys(commandData).reduce((a, c) => {
    console.log('c', c)
    const data = commandData[c]

    a[c.name] = data

    return Object.assign({}, a, {
      objectID: c,
    })
  }, {})
}
*/

// console.log('flattenedData', flattenedData)
// console.log('commandData', commandData)

const algoliaData = Object.keys(flattenedData).map(key => {
  const command = flattenedData[key]
  // delete command.commands

  const data = Object.assign({}, command, {
    objectID: key,
  })

  return data
})

console.log('algoliaData', algoliaData)

const algoliaIndex = algoliaClient.initIndex(algoliaIndexName)

algoliaIndex.addObjects(algoliaData, (err, content) => {
  console.log(content)
})
