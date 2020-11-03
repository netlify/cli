'use strict'

const makeNetlifyTOMLtemplate = ({ command = '# no build command', publish = '.' }) => `# example netlify.toml
[build]
  command = "${command}"
  functions = "functions"
  publish = "${publish}"

  ## Uncomment to use this redirect for Single Page Applications like create-react-app. 
  ## Not needed for static site generators.
  #[[redirects]]
  #  from = "/*"
  #  to = "/index.html"
  #  status = 200
  
  ## (optional) Settings for Netlify Dev
  ## https://github.com/netlify/cli/blob/master/docs/netlify-dev.md#project-detection
  #[dev] 
  #  command = "yarn start" # Command to start your dev server
  #  port = 3000 # Port that the dev server will be listening on
  #  publish = "dist" # Folder with the static content for _redirect file
  
  ## more info on configuring this file: https://www.netlify.com/docs/netlify-toml-reference/ 
`
module.exports = { makeNetlifyTOMLtemplate }
