import fetch from 'node-fetch'

export const getTemplatesFromGitHub = async (token) => {
  const getPublicGitHubReposFromOrg = new URL(`https://api.github.com/orgs/netlify-templates/repos`)
  // GitHub returns 30 by default and we want to avoid our limit
  // due to our archived repositories at any given time
  const REPOS_PER_PAGE = 70

  getPublicGitHubReposFromOrg.searchParams.set('type', 'public')
  getPublicGitHubReposFromOrg.searchParams.set('sort', 'full_name')
  getPublicGitHubReposFromOrg.searchParams.set('per_page', REPOS_PER_PAGE)

  const templates = await fetch(getPublicGitHubReposFromOrg, {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
    },
  })
  const allTemplates = await templates.json()

  return allTemplates
}

export const validateTemplate = async ({ ghToken, templateName }) => {
  const response = await fetch(`https://api.github.com/repos/${templateName}`, {
    headers: {
      Authorization: `token ${ghToken}`,
    },
  })

  if (response.status === 404) {
    return { exists: false }
  }

  if (!response.ok) {
    throw new Error(`Error fetching template ${templateName}: ${await response.text()}`)
  }

  const data = await response.json()

  return { exists: true, isTemplate: data.is_template }
}

export const createRepo = async (templateName, ghToken, siteName) => {
  const resp = await fetch(`https://api.github.com/repos/${templateName}/generate`, {
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
