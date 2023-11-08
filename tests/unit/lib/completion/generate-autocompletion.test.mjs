 
import fs from 'fs'

import { Argument } from 'commander'
import { describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.mjs'
import generateAutocompletion from '../../../../src/lib/completion/generate-autocompletion.mjs'

const createTestCommand = async () => {
  const program = new BaseCommand('chef')

  program
    .command('bake')
    .alias('cook')
    .description('Cooks something')
    .addExamples(['chef cook pizza'])
    .argument('<type>', 'the type to cook')
    .option('-f, --fast', 'cook it fast')

  program.command('bake:pizza').description('bakes a pizza').option('--type <type>', 'Type of pizza', 'neapolitan')

  program
    .command('taste')
    .description('tastes something')
    .addArgument(new Argument('<name>', 'what to taste').choices(['pizza', 'sauce']))

  return program
}

describe('generateAutocompletion', () => {
  test('should generate a completion file', async () => {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
    const program = await createTestCommand()

    generateAutocompletion(program)

    expect(fs.writeFileSync).toHaveBeenCalledOnce()

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/autocompletion\.json$/),
      expect.anything(),
      'utf-8',
    )
    expect(fs.writeFileSync.lastCall).toMatchSnapshot()

    fs.writeFileSync.mockRestore()
  })
})
