const execa = require('execa')
module.exports = {
  name: 'fauna-crud',
  description: 'CRUD function using Fauna DB',
  addons: [
    {
      addonName: 'fauna',
      addonDidInstall(fnPath) {
        execa.sync(fnPath + '/create-schema.js', undefined, {
          env: process.env,
          stdio: 'inherit'
        })
      }
    }
  ]
}
