const execa = require('execa')
module.exports = {
  name: 'fauna-graphql',
  description: 'GraphQL Backend using Fauna DB',
  addons: [
    {
      addonName: 'fauna',
      addonDidInstall(fnPath) {
        execa.sync(fnPath + '/sync-schema.js', undefined, {
          env: process.env,
          stdio: 'inherit'
        })
      }
    }
  ]
}
