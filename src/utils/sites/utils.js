const fetch = require('node-fetch')

const getTemplatesFromGitHub = async (token) => {
  const templates = await fetch(`https://api.github.com/orgs/netlify-templates/repos`, {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
    },
  })
  const allTemplates = await templates.json()

  return allTemplates
}

const createRepo = async (templateUrl, ghToken, siteName) => {
  const resp = await fetch(`https://api.github.com/repos/${templateUrl.templateName}/generate`, {
    method: 'POST',
    headers: {
      Authorization: `token ${ghToken}`,
    },
    body: JSON.stringify({
      name: siteName,
    }),
  })

  const data = await resp.json()
  return data
}

module.exports = { getTemplatesFromGitHub, createRepo }
