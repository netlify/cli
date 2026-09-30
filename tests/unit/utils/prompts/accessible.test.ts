import { PassThrough, Writable } from 'stream'

import { CANCEL_SYMBOL, settings, type TextOptions } from '@clack/prompts'
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  accessibleAutocomplete,
  accessibleConfirm,
  accessiblePassword,
  accessibleSelect,
  accessibleText,
  isAccessible,
} from '../../../../src/utils/prompts/accessible.js'

const collect = () => {
  const written: string[] = []
  const output = new Writable({
    write(chunk: Buffer | string, _encoding, done) {
      written.push(String(chunk))
      done()
    },
  })
  return { output, written: () => written.join('') }
}

/** A stream that claims to be a terminal, so that hiding input has something to switch off. */
class FakeTTY extends PassThrough {
  isTTY = true
  isRaw = false
  setRawMode = vi.fn((mode: boolean) => {
    this.isRaw = mode
    return this
  })
}

const streams = (answers = '') => {
  const input = new PassThrough()
  input.write(answers)
  return { input, ...collect() }
}

afterEach(() => {
  vi.unstubAllEnvs()
  settings.accessible = undefined
})

describe('isAccessible', () => {
  test('is off unless asked for', () => {
    expect(isAccessible()).toBe(false)
  })

  test.each(['1', 'true', 'yes'])('is on for ACCESSIBLE=%s', (value) => {
    vi.stubEnv('ACCESSIBLE', value)

    expect(isAccessible()).toBe(true)
  })

  test.each(['', '0', 'false'])('is off for ACCESSIBLE=%s', (value) => {
    vi.stubEnv('ACCESSIBLE', value)

    expect(isAccessible()).toBe(false)
  })

  test('lets the prompt library settings override the environment', () => {
    vi.stubEnv('ACCESSIBLE', '1')
    settings.accessible = false

    expect(isAccessible()).toBe(false)
  })
})

describe('accessibleText', () => {
  test('asks the question and returns the answer', async () => {
    const { input, output, written } = streams('my-function\n')

    await expect(accessibleText({ message: 'Name your function', input, output })).resolves.toBe('my-function')
    expect(written()).toBe('Name your function: \n')
  })

  test('offers the default value and returns it for a blank answer', async () => {
    const { input, output, written } = streams('\n')

    await expect(accessibleText({ message: 'Publish directory', defaultValue: '.', input, output })).resolves.toBe('.')
    expect(written()).toBe('Publish directory [.]: \n')
  })

  test('offers a placeholder as an example, since a blank answer does not submit it', async () => {
    const { input, output, written } = streams('\n')

    await expect(accessibleText({ message: 'Path', placeholder: './ai-context', input, output })).resolves.toBe('')
    expect(written()).toBe('Path (for example ./ai-context): \n')
  })

  test('validates the default value, not the blank answer standing in for it', async () => {
    const { input, output, written } = streams('\n')
    const validate = (value: string | undefined) => (value ? undefined : 'Enter a route')

    await expect(accessibleText({ message: 'Route', defaultValue: '/test', validate, input, output })).resolves.toBe(
      '/test',
    )
    expect(written()).not.toContain('Enter a route')
  })

  test('repeats the question until the answer validates', async () => {
    const { input, output, written } = streams('no\nyes\n')
    const validate = (value: string | undefined) => (value === 'yes' ? undefined : new Error('Say yes'))

    await expect(accessibleText({ message: 'Well?', validate, input, output })).resolves.toBe('yes')
    expect(written()).toBe('Well?: \nSay yes\nWell?: \n')
  })

  test('reports the first problem a standard schema validator finds', async () => {
    const { input, output, written } = streams('nope\nyes\n')
    const validate: NonNullable<TextOptions['validate']> = {
      '~standard': {
        version: 1,
        vendor: 'netlify-cli-test',
        validate: (value) => (value === 'yes' ? { value: 'yes' } : { issues: [{ message: 'Say yes' }] }),
      },
    }

    await expect(accessibleText({ message: 'Well?', validate, input, output })).resolves.toBe('yes')
    expect(written()).toContain('Say yes')
  })

  test('strips styling out of the question, which a screen reader would read out', async () => {
    const { input, output, written } = streams('x\n')

    await expect(accessibleText({ message: '\u001B[33mPick a name\u001B[39m', input, output })).resolves.toBe('x')
    expect(written()).toBe('Pick a name: \n')
  })

  test('is cancelled when the input ends without an answer', async () => {
    const { input, output } = streams()
    const answer = accessibleText({ message: 'Name', input, output })

    input.end()

    await expect(answer).resolves.toBe(CANCEL_SYMBOL)
  })
})

describe('accessiblePassword', () => {
  test('keeps the secret out of the terminal', async () => {
    const input = new FakeTTY()
    const { output, written } = collect()
    const answer = accessiblePassword({ message: 'Your GitHub token', input, output })

    input.write('s3cret\r')

    await expect(answer).resolves.toBe('s3cret')
    expect(written()).toBe('Your GitHub token: \n')
    expect(input.setRawMode).toHaveBeenCalledWith(true)
    expect(input.isRaw).toBe(false)
  })

  test('erases the last character when typing is hidden', async () => {
    const input = new FakeTTY()
    const { output } = collect()
    const answer = accessiblePassword({ message: 'Token', input, output })

    input.write('s3crxt\u007F\u007Ft\r')

    await expect(answer).resolves.toBe('s3crt')
  })

  test('is cancelled by Ctrl+C, which hidden typing receives as input rather than as a signal', async () => {
    const input = new FakeTTY()
    const { output } = collect()
    const answer = accessiblePassword({ message: 'Token', input, output })

    input.write('\u0003')

    await expect(answer).resolves.toBe(CANCEL_SYMBOL)
  })
})

describe('accessibleConfirm', () => {
  test.each([
    ['y', true],
    ['YES', true],
    ['n', false],
    ['No', false],
  ] as const)('reads %s as %s', async (answer, expected) => {
    const { input, output } = streams(`${answer}\n`)

    await expect(accessibleConfirm({ message: 'Continue?', input, output })).resolves.toBe(expected)
  })

  test.each([
    [true, 'Continue? [Y/n]: \n'],
    [false, 'Continue? [y/N]: \n'],
  ] as const)('shows and returns %s as the answer a blank line gives', async (initialValue, question) => {
    const { input, output, written } = streams('\n')

    await expect(accessibleConfirm({ message: 'Continue?', initialValue, input, output })).resolves.toBe(initialValue)
    expect(written()).toBe(question)
  })

  test('accepts the labels the caller chose, and says what it wants otherwise', async () => {
    const { input, output, written } = streams('maybe\nOverwrite\n')

    await expect(
      accessibleConfirm({ message: 'File exists', active: 'Overwrite', inactive: 'Keep', input, output }),
    ).resolves.toBe(true)
    expect(written()).toContain('Enter Overwrite or Keep.')
  })

  test('is cancelled when the prompt is aborted', async () => {
    const { input, output } = streams()
    const controller = new AbortController()
    const answer = accessibleConfirm({ message: 'Continue?', input, output, signal: controller.signal })

    controller.abort()

    await expect(answer).resolves.toBe(CANCEL_SYMBOL)
  })
})

describe('accessibleSelect', () => {
  const projects = [
    { value: 'alpha', label: 'Alpha' },
    { value: 'beta', label: 'Beta', hint: 'most recent' },
    { value: 'gamma', label: 'Gamma', disabled: true },
  ]

  test('numbers the options and returns the one picked', async () => {
    const { input, output, written } = streams('2\n')

    await expect(accessibleSelect({ message: 'Pick a project', options: projects, input, output })).resolves.toBe(
      'beta',
    )
    expect(written()).toBe(
      ['Pick a project', '  1. Alpha', '  2. Beta (most recent)', 'Enter a number between 1 and 2 [1]: ', ''].join(
        '\n',
      ),
    )
  })

  test('points a blank answer at the initial value', async () => {
    const { input, output, written } = streams('\n')

    await expect(
      accessibleSelect({ message: 'Pick', options: projects, initialValue: 'beta', input, output }),
    ).resolves.toBe('beta')
    expect(written()).toContain('[2]: ')
  })

  test('asks again when the answer is not one of the numbers', async () => {
    const { input, output, written } = streams('9\nzero\n1\n')

    await expect(accessibleSelect({ message: 'Pick', options: projects, input, output })).resolves.toBe('alpha')
    expect(written().match(/Enter a number between 1 and 2\./g)).toHaveLength(2)
  })

  test('refuses to ask a question with no answers', async () => {
    const { input, output } = streams()

    await expect(accessibleSelect({ message: 'Pick', options: [], input, output })).rejects.toThrow(
      'No options to choose from for "Pick"',
    )
  })
})

describe('accessibleAutocomplete', () => {
  test('lists every option instead of filtering as you type', async () => {
    const { input, output, written } = streams('3\n')
    const options = [{ value: 'a' }, { value: 'b' }, { value: 'c' }]

    await expect(accessibleAutocomplete({ message: 'Search', options, input, output })).resolves.toBe('c')
    expect(written()).toContain('  3. c')
  })

  test('resolves options given as a getter', async () => {
    const { input, output } = streams('1\n')

    await expect(
      accessibleAutocomplete({ message: 'Search', options: () => [{ value: 'only' }], input, output }),
    ).resolves.toBe('only')
  })
})

describe('reading the input stream', () => {
  test('keeps answers that arrive before the prompt that asks for them', async () => {
    const { input, output } = streams('first\nsecond\n')

    await expect(accessibleText({ message: 'One', input, output })).resolves.toBe('first')
    await expect(accessibleText({ message: 'Two', input, output })).resolves.toBe('second')
  })

  test('takes a carriage return and line feed together as one answer', async () => {
    const { input, output } = streams('first\r\nsecond\r\n')

    await expect(accessibleText({ message: 'One', input, output })).resolves.toBe('first')
    await expect(accessibleText({ message: 'Two', input, output })).resolves.toBe('second')
  })

  test('says to stop reading again after taking an answer, since a read restarts itself', async () => {
    const { input, output } = streams('answer\n')
    const paused = vi.fn()
    input.on('pause', paused)

    await accessibleText({ message: 'One', input, output })

    expect(input.isPaused()).toBe(true)
    // Pausing an already paused stream emits nothing, and a piped stdin keeps the process alive until
    // it sees the event, so the prompt has to raise it itself.
    expect(paused.mock.calls.length).toBeGreaterThan(1)
  })
})
