import { sync } from 'execa'

export const config = {
  name: 'fauna-crud',
  description: 'CRUD function using Fauna DB',
  addons: [
    {
      addonName: 'fauna',
      addonDidInstall(fnPath) {
        sync(fnPath + '/create-schema.js', undefined, {
          stdio: 'inherit',
        })
      },
    },
  ],
}
