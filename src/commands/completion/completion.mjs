import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { install } from 'tabtab'

import { generateAutocompletion } from '../../lib/completion/index.mjs'

const completer = join(dirname(fileURLToPath(import.meta.url)), '../../lib/completion/script.mjs')

/**
 * The completion:generate command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
export const completionGenerate = async (options, command) => {
  const { parent } = command

  generateAutocompletion(parent)

  await install({
    name: parent.name(),
    completer,
  })

  console.log(`Completion for ${parent.name()} successful installed!`)
}
