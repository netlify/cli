import fetch from 'node-fetch'
import execa from 'execa'

import { GitHubRepoResponse, logAndThrowError } from '../command-helpers.js'
import { GitHubRepo } from '../types.js'

export const getTemplatesFromGitHub = async (token: string): Promise<GitHubRepo[]> => {
  const getPublicGitHubReposFromOrg = new URL(`https://api.github.com/orgs/netlify-templates/repos`)
  // GitHub returns 30 by default and we want to avoid our limit
  // due to our archived repositories at any given time
  const REPOS_PER_PAGE = 70

  getPublicGitHubReposFromOrg.searchParams.set('type', 'public')
  getPublicGitHubReposFromOrg.searchParams.set('sort', 'full_name')
  // @ts-expect-error TS(2345) FIXME: Argument of type 'number' is not assignable to par... Remove this comment to see the full error message
  getPublicGitHubReposFromOrg.searchParams.set('per_page', REPOS_PER_PAGE)

  let allTemplates: GitHubRepo[] = []
  try {
    const templates = await fetch(getPublicGitHubReposFromOrg, {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
      },
    })
    allTemplates = (await templates.json()) as GitHubRepo[]
  } catch (error_) {
    return logAndThrowError(error_)
  }
  return allTemplates
}
