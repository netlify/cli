import { CANCEL_SYMBOL } from '@clack/prompts'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { mockClack, mockExit } = vi.hoisted(() => ({
  mockClack: {
    text: vi.fn(),
    password: vi.fn(),
    confirm: vi.fn(),
    select: vi.fn(),
    autocomplete: vi.fn(),
    cancel: vi.fn(),
    intro: vi.fn(),
    outro: vi.fn(),
    note: vi.fn(),
  },
  mockExit: vi.fn((code?: number) => {
    throw new Error(`exit(${String(code)})`)
  }),
}))

vi.mock('@clack/prompts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clack/prompts')>()),
  ...mockClack,
}))

vi.mock('../../../../src/utils/command-helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/command-helpers.js')>()),
  exit: mockExit,
}))

import {
  intro,
  note,
  promptAutocomplete,
  promptConfirm,
  promptPassword,
  promptSelect,
  promptText,
} from '../../../../src/utils/prompts/index.js'

const originalIsTTY = process.stdin.isTTY
const setStdinTTY = (isTTY: boolean | undefined) => {
  Object.defineProperty(process.stdin, 'isTTY', { value: isTTY, configurable: true })
}

let resumeSpy: ReturnType<typeof vi.spyOn>
let pauseSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  resumeSpy = vi.spyOn(process.stdin, 'resume').mockReturnValue(process.stdin)
  pauseSpy = vi.spyOn(process.stdin, 'pause').mockReturnValue(process.stdin)
  setStdinTTY(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  setStdinTTY(originalIsTTY)
})

describe('promptText', () => {
  test('returns the submitted value and forwards options', async () => {
    mockClack.text.mockResolvedValue('my-fn')

    await expect(promptText({ message: 'Name your function', placeholder: 'hello' })).resolves.toBe('my-fn')

    expect(mockClack.text).toHaveBeenCalledWith({ message: 'Name your function', placeholder: 'hello' })
  })

  test('validates the default value when the input is left empty', async () => {
    const validate = vi.fn((value: string | undefined) => (value ? undefined : 'required'))
    mockClack.text.mockResolvedValue('/test')

    await promptText({ message: 'Route', defaultValue: '/test', validate })

    const forwarded = mockClack.text.mock.calls[0]?.[0] as { validate: (value: string | undefined) => unknown }
    expect(forwarded.validate('')).toBeUndefined()
    expect(forwarded.validate(undefined)).toBeUndefined()
    expect(validate).toHaveBeenLastCalledWith('/test')

    expect(forwarded.validate('/typed')).toBeUndefined()
    expect(validate).toHaveBeenLastCalledWith('/typed')
  })

  test('leaves the validator untouched when there is no default value', async () => {
    const validate = () => undefined
    mockClack.text.mockResolvedValue('x')

    await promptText({ message: 'Anything', validate })

    expect(mockClack.text).toHaveBeenCalledWith({ message: 'Anything', validate })
  })

  test('prints a cancel message and exits with 130 when the user cancels', async () => {
    mockClack.text.mockResolvedValue(CANCEL_SYMBOL)

    await expect(promptText({ message: 'Anything' })).rejects.toThrow('exit(130)')

    expect(mockClack.cancel).toHaveBeenCalledWith('Cancelled.')
    expect(mockExit).toHaveBeenCalledWith(130)
  })
})

describe('promptConfirm', () => {
  test('returns the boolean answer', async () => {
    mockClack.confirm.mockResolvedValue(false)

    await expect(promptConfirm({ message: 'Continue?', initialValue: false })).resolves.toBe(false)
  })

  test('treats a timed-out prompt as declining instead of exiting', async () => {
    mockClack.confirm.mockResolvedValue(CANCEL_SYMBOL)
    const controller = new AbortController()
    controller.abort()

    await expect(promptConfirm({ message: 'Did you mean?', signal: controller.signal })).resolves.toBe(false)

    expect(mockClack.cancel).not.toHaveBeenCalled()
    expect(mockExit).not.toHaveBeenCalled()
  })

  test('exits when cancelled without an aborted signal', async () => {
    mockClack.confirm.mockResolvedValue(CANCEL_SYMBOL)
    const controller = new AbortController()

    await expect(promptConfirm({ message: 'Did you mean?', signal: controller.signal })).rejects.toThrow('exit(130)')

    expect(mockClack.cancel).toHaveBeenCalledWith('Cancelled.')
  })
})

describe('promptSelect, promptAutocomplete, promptPassword', () => {
  test('return the chosen value', async () => {
    mockClack.select.mockResolvedValue({ id: 1 })
    mockClack.autocomplete.mockResolvedValue('apps/web')
    mockClack.password.mockResolvedValue('s3cret')

    await expect(promptSelect({ message: 'Pick', options: [{ value: { id: 1 }, label: 'one' }] })).resolves.toEqual({
      id: 1,
    })
    await expect(promptAutocomplete({ message: 'Search', options: [{ value: 'apps/web' }] })).resolves.toBe('apps/web')
    await expect(promptPassword({ message: 'Token' })).resolves.toBe('s3cret')
  })

  test.each([
    ['promptSelect', () => promptSelect({ message: 'Pick', options: [{ value: 'a' }] }), mockClack.select],
    [
      'promptAutocomplete',
      () => promptAutocomplete({ message: 'Search', options: [{ value: 'a' }] }),
      mockClack.autocomplete,
    ],
    ['promptPassword', () => promptPassword({ message: 'Token' }), mockClack.password],
  ])('%s exits with 130 when cancelled', async (_name, run, mock) => {
    mock.mockResolvedValue(CANCEL_SYMBOL)

    await expect(run()).rejects.toThrow('exit(130)')

    expect(mockExit).toHaveBeenCalledWith(130)
  })
})

describe('piped stdin', () => {
  test('cycles resume/pause after a prompt so a piped stdin does not keep the process alive', async () => {
    setStdinTTY(undefined)
    mockClack.text.mockResolvedValue('value')

    await promptText({ message: 'Anything' })

    expect(resumeSpy).toHaveBeenCalledOnce()
    expect(pauseSpy).toHaveBeenCalledOnce()
    expect(resumeSpy.mock.invocationCallOrder[0]).toBeLessThan(pauseSpy.mock.invocationCallOrder[0] ?? 0)
  })

  test('leaves a TTY stdin alone', async () => {
    setStdinTTY(true)
    mockClack.confirm.mockResolvedValue(true)

    await promptConfirm({ message: 'Continue?' })

    expect(resumeSpy).not.toHaveBeenCalled()
    expect(pauseSpy).not.toHaveBeenCalled()
  })
})

describe('branding helpers', () => {
  test('intro prefixes the title with the Netlify glyph', () => {
    intro('Netlify Link')

    expect(mockClack.intro).toHaveBeenCalledOnce()
    expect(mockClack.intro.mock.calls[0]?.[0]).toContain('⬥')
    expect(mockClack.intro.mock.calls[0]?.[0]).toContain('Netlify Link')
  })

  test('note forwards message and title', () => {
    note('body', 'Heads up')

    expect(mockClack.note).toHaveBeenCalledWith('body', 'Heads up')
  })
})
