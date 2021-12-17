import { execaSync } from 'execa'

export default {
  name: 'fauna-crud',
  description: 'CRUD function using Fauna DB',
  addons: [
    {
      addonName: 'fauna',
      addonDidInstall(fnPath) {
        execaSync(fnPath + '/create-schema.js', undefined, {
          stdio: 'inherit',
        })
      },
    },
  ],
}
