'use strict'

const chalk = require('chalk')

console.log('')
console.log(chalk.greenBright.bold.underline(`Success! Netlify CLI has been installed!`))
console.log('')
console.log('Your device is now configured to use Netlify CLI to deploy and manage your Netlify sites.')
console.log('')
console.log('Next steps:')
console.log('')
console.log(`  ${chalk.cyanBright.bold('netlify init')}     Connect or create a Netlify site from current directory`)
console.log(`  ${chalk.cyanBright.bold('netlify deploy')}   Deploy the latest changes to your Netlify site`)
console.log('')
console.log(`For more information on the CLI run ${chalk.cyanBright.bold('netlify help')}`)
console.log(`Or visit the docs at ${chalk.cyanBright.bold('https://cli.netlify.com')}`)
console.log('')
