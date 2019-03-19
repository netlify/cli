const makeNetlifyTOMLtemplate = ({ command = '# no build command', publish = '.' }) => `# example netlify.toml
[build]
  command = "${command}"
  functions = "functions" #  netlify-lambda reads this
  publish = "${publish}"


## COMMENT: This a redirect often used for Single Page Applications
#[[redirects]]
#  from = "/*"
#  to = "/index.html"
#  status = 200

## more info https://www.netlify.com/docs/netlify-toml-reference/
`
module.exports = { makeNetlifyTOMLtemplate }
