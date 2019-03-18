const makeNetlifyTOMLtemplate = ({ command, publish }) => `# example netlify.toml
[build]
  command = "${command}"
  functions = "lambda" #  netlify-lambda reads this
  publish = "${publish}"


# COMMENT: This a rule for Single Page Applications
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

## more info https://www.netlify.com/docs/netlify-toml-reference/
`
module.exports = { makeNetlifyTOMLtemplate }
