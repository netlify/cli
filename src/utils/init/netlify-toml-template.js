const makeNetlifyTOMLtemplate = ({ command = '# no build command', publish = '.' }) => `# example netlify.toml
[build]
  command = "${command}"
  functions = "functions"
  publish = "${publish}"

## Uncomment to use this redirect for Single Page Applications. 
## Not needed for static site generators.
#[[redirects]]
#  from = "/*"
#  to = "/index.html"
#  status = 200

## more info https://www.netlify.com/docs/netlify-toml-reference/
`
module.exports = { makeNetlifyTOMLtemplate }
