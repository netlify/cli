// @ts-check
import fs from 'fs'

import test from 'ava'
import { Argument } from 'commander'
import sinon from 'sinon'

const createTestCommand = async () => {
  const { default: BaseCommand } = await import('../../../../src/commands/base-command.mjs')
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

test.afterEach(() => {
  // eslint-disable-next-line import/no-named-as-default-member
  sinon.restore()
})

test('should generate a completion file', async (t) => {
  // eslint-disable-next-line import/no-named-as-default-member
  const stub = sinon.stub(fs, 'writeFileSync').callsFake(() => {})
  const { default: generateAutocompletion } = await import('../../../../src/lib/completion/generate-autocompletion.mjs')
  const program = await createTestCommand()

  generateAutocompletion(program)

  // @ts-ignore
  t.true(stub.getCall(0).args[0].endsWith('autocompletion.json'), 'should write a autocompletion file')

  // @ts-ignore
  t.snapshot(JSON.parse(stub.getCall(0).args[1]))

  stub.restore()
})
