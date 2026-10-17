import { logAndThrowError } from './command-helpers.js'
import type { MinimalAccount } from './types.js'

export const requireTeams = (accounts: MinimalAccount[] | undefined): MinimalAccount[] => {
  const teams = accounts ?? []
  if (teams.length === 0) {
    return logAndThrowError('No teams available. Please ensure you have access to at least one team.')
  }
  return teams
}

export const resolveTeam = (accounts: MinimalAccount[]): MinimalAccount | undefined => {
  if (accounts.length === 1) {
    return accounts[0]
  }
  return accounts.find((acc) => acc.default)
}

export const resolveTeamForNonInteractive = (accounts: MinimalAccount[], commandExample: string): MinimalAccount => {
  const teams = requireTeams(accounts)

  const team = resolveTeam(teams)
  if (team) {
    return team
  }

  const availableTeams = teams.map((t) => t.slug).join(', ')
  return logAndThrowError(
    `Multiple teams available. Please specify which team to use.\n` +
      `Available teams: ${availableTeams}\n\n` +
      `Example: ${commandExample}\n\n` +
      `To list teams with full details, run:  netlify teams:list`,
  )
}
