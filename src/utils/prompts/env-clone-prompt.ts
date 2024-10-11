import { chalk, log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'

type User = {
  id: string
  email: string
  avatar_url: string
  full_name: string
}

type EnvVar = {
  key: string
  scopes: string[]
  values: Record<string, any>[]
  updated_at: string
  updated_by: User
  is_secret: boolean
}

const generateSetMessage = (envVarsToDelete: EnvVar[], siteId: string): void => {
  log()
  log(
    `${chalk.redBright(
      'Warning',
    )}: The following environment variables are already set on the site with ID ${chalk.bgBlueBright(
      siteId,
    )}. They will be overwritten!`,
  )
  log()

  log(`${chalk.yellowBright('Notice')}: The following variables will be overwritten:`)
  log()
  envVarsToDelete.forEach((envVar) => {
    log(envVar.key)
  })

  log()
  log(
    `${chalk.yellowBright(
      'Notice',
    )}: To overwrite the existing variables without confirmation prompts, pass the -s or --skip flag.`,
  )
}

export const envClonePrompts = async (siteId: string, envVarsToDelete: EnvVar[]): Promise<void> => {
  generateSetMessage(envVarsToDelete, siteId)
  await confirmPrompt('Do you want to proceed with overwriting these variables?')
}
