import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'pars... Remove this comment to see the full error message
import parseGitHubUrl from 'parse-github-url'

import { log } from '../command-helpers.js'

// @ts-expect-error TS(7006) FIXME: Parameter 'token' implicitly has an 'any' type.
export const getTemplatesFromGitHub = async (token) => {
  const getPublicGitHubReposFromOrg = new URL(`https://api.github.com/orgs/netlify-templates/repos`)
  // GitHub returns 30 by default and we want to avoid our limit
  // due to our archived repositories at any given time
  const REPOS_PER_PAGE = 70

  getPublicGitHubReposFromOrg.searchParams.set('type', 'public')
  getPublicGitHubReposFromOrg.searchParams.set('sort', 'full_name')
  // @ts-expect-error TS(2345) FIXME: Argument of type 'number' is not assignable to par... Remove this comment to see the full error message
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

// @ts-expect-error TS(7031) FIXME: Binding element 'ghToken' implicitly has an 'any' ... Remove this comment to see the full error message
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

  // @ts-expect-error TS(18046) - 'data' is of type 'unknown'
  return { exists: true, isTemplate: data.is_template }
}

export const createRepo = async (templateName: string, ghToken: string, siteName: string) => {
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

export const renameRepo = async (templateName: string, ghToken: string, siteName: string) => {
  const resp = await fetch(`https://api.github.com/repos/${templateName}/generate`, {
    method: 'PATCH',
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
// https://stackoverflow.com/questions/4777535/how-do-i-rename-a-github-repository-via-their-api

export const fetchTemplates = async (token: string) => {
  const templatesFromGithubOrg = await getTemplatesFromGitHub(token)

  return (
    // @ts-expect-error TS(18046) - 'templatesFromGithubOrg' if of type 'unknown'
    templatesFromGithubOrg
      // @ts-expect-error TS(7006) FIXME: Parameter 'repo' implicitly has an 'any' type.
      .filter((repo) => !repo.archived && !repo.disabled)
      // @ts-expect-error TS(7006) FIXME: Parameter 'template' implicitly has an 'any' type.
      .map((template) => ({
        name: template.name,
        sourceCodeUrl: template.html_url,
        slug: template.full_name,
      }))
  )
}

export const getTemplateName = async ({
  ghToken,
  options,
  repository,
}: {
  ghToken: string
  options: OptionValues
  repository: string
}) => {
  if (repository) {
    const { repo } = parseGitHubUrl(repository)
    return repo || `netlify-templates/${repository}`
  }

  if (options.url) {
    const urlFromOptions = new URL(options.url)
    return urlFromOptions.pathname.slice(1)
  }

  const templates = await fetchTemplates(ghToken)

  log(`Choose one of our starter templates. Netlify will create a new repo for this template in your GitHub account.`)

  const { templateName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'templateName',
      message: 'Template:',
      // @ts-expect-error TS(7006) FIXME: Parameter 'template' implicitly has an 'any' type.
      choices: templates.map((template) => ({
        value: template.slug,
        name: template.name,
      })),
    },
  ])

  return templateName
}

export const getGitHubLink = ({ options, templateName }: { options: OptionValues; templateName: string }) =>
  options.url || `https://github.com/${templateName}`

export const deployedSiteExists = async (name: string): Promise<boolean> => {
  const resp = await fetch(`https://${name}.netlify.app`, {
    method: 'GET',
  })

  return resp.status === 200
}
