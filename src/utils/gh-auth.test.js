const createGithubPAT = require('./gh-auth')

createGithubPAT()
  .then(console.log)
  .catch(console.error)
