import fsPromises from 'fs/promises'
import fs from 'fs'
import inquirer from 'inquirer'
import BaseCommand from '../base-command.js'

export const carefullyWriteFile = async (filePath: string, data: string, projectRoot: string) => {
  if (fs.existsSync(filePath)) {
    type Answers = {
      overwrite: boolean
    }
    const answers = await inquirer.prompt<Answers>([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Overwrite existing file .${filePath.replace(projectRoot, '')}?`,
      },
    ])
    if (answers.overwrite) {
      await fsPromises.writeFile(filePath, data)
    }
  } else {
    await fsPromises.writeFile(filePath, data)
  }
}

export const getAccount = async (
  command: BaseCommand,
  {
    accountId,
  }: {
    accountId: string
  },
) => {
  let account: Awaited<ReturnType<typeof command.netlify.api.getAccount>>[number]
  try {
    // @ts-expect-error -- TODO: fix the getAccount type in the openapi spec. It should not be an array of accounts, just one account.
    account = await command.netlify.api.getAccount({ accountId })
  } catch (e) {
    throw new Error(`Error getting account, make sure you are logged in with netlify login`, {
      cause: e,
    })
  }
  if (!account.id || !account.name) {
    throw new Error(`Error getting account, make sure you are logged in with netlify login`)
  }
  return account as { id: string; name: string } & Omit<
    Awaited<ReturnType<typeof command.netlify.api.getAccount>>[number],
    'id' | 'name'
  >
}
