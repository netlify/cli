import execa from 'execa'

export default {
  name: 'fauna-crud',
  description: 'CRUD function using Fauna DB',
  functionType: 'serverless',
  addons: [
    {
      addonName: 'fauna',
      addonDidInstall(fnPath) {
        execa.sync(fnPath + '/create-schema.js', undefined, {
          stdio: 'inherit',
        })
      },
    },
  ],
}
