const chalk = require('chalk')
const config = require('./config')

const WEBUI = 'https://app.netlify.com'

function webui(path) {
  var url = WEBUI + join('', path),
    p = open(url)

  return when.promise(function(resolve, reject) {
    p.on('exit', function(code) {
      if (parseInt(code) > 0) {
        console.log('Please visite this authentication URL in your browser:\n  ' + chalk.bold(url))
      } else {
        console.log('Opening ' + chalk.bold(url))
      }

      resolve(code)
    })
  })
}
