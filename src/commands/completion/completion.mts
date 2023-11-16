import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { OptionValues } from 'commander'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'tabt... Remove this comment to see the full error message
import { install, uninstall } from 'tabtab'

import { generateAutocompletion } from '../../lib/completion/index.mjs'
import { error } from '../../utils/command-helpers.mjs'
import BaseCommand from '../base-command.mjs'

const completer = join(dirname(fileURLToPath(import.meta.url)), '../../lib/completion/script.mjs')

export const completionGenerate = async (options: OptionValues, command: BaseCommand) => {
  const { parent } = command

  if (!parent) {
    error(`There has been an error generating the completion script.`)
    return
  }

  generateAutocompletion(parent)

  await install({
    name: parent.name(),
    completer,
  })

  console.log(`Completion for ${parent.name()} successful installed!`)
}

export const completionUninstall = async (options: OptionValues, command: BaseCommand) => {
  if (!command.parent) {
    error(`There has been an error deleting the completion script.`)
    return
  }
  await uninstall({
    name: command.parent.name(),
  })
}
