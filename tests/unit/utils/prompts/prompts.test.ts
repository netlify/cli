import { CANCEL_SYMBOL } from '@clack/prompts'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { mockClack, mockExit, mockIsOutputSuppressed } = vi.hoisted(() => ({
  mockIsOutputSuppressed: vi.fn(() => false),
  mockClack: {
    text: vi.fn(),
    password: vi.fn(),
    confirm: vi.fn(),
    select: vi.fn(),
    autocomplete: vi.fn(),
    cancel: vi.fn(),
    intro: vi.fn(),
    outro: vi.fn(),
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
  isOutputSuppressed: () => mockIsOutputSuppressed(),
}))

import {
  intro,
  outro,
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
  mockIsOutputSuppressed.mockReturnValue(false)
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

  test('treats a prompt left unanswered past its timeout as declining instead of exiting', async () => {
    mockClack.confirm.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            resolve(CANCEL_SYMBOL)
          })
        }),
    )

    await expect(promptConfirm({ message: 'Did you mean?', timeout: 5 })).resolves.toBe(false)

    expect(mockClack.cancel).not.toHaveBeenCalled()
    expect(mockExit).not.toHaveBeenCalled()
  })

  test('exits when the user cancels a prompt that has a timeout', async () => {
    mockClack.confirm.mockResolvedValue(CANCEL_SYMBOL)

    await expect(promptConfirm({ message: 'Did you mean?', timeout: 10_000 })).rejects.toThrow('exit(130)')

    expect(mockClack.cancel).toHaveBeenCalledWith('Cancelled.')
  })

  test('stops the timeout once answered, so the prompt is not closed a second time', async () => {
    vi.useFakeTimers()
    try {
      let abortedAfterAnswer = false
      mockClack.confirm.mockImplementation(({ signal }: { signal: AbortSignal }) => {
        signal.addEventListener('abort', () => {
          abortedAfterAnswer = true
        })
        return Promise.resolve(true)
      })

      await expect(promptConfirm({ message: 'Did you mean?', timeout: 10_000 })).resolves.toBe(true)
      vi.advanceTimersByTime(60_000)

      expect(abortedAfterAnswer).toBe(false)
    } finally {
      vi.useRealTimers()
    }
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
  test('signals a pause after a prompt so a piped stdin does not keep the process alive', async () => {
    setStdinTTY(undefined)
    mockClack.text.mockResolvedValue('value')
    const paused = vi.fn()
    process.stdin.on('pause', paused)

    try {
      await promptText({ message: 'Anything' })

      // Emitting the event is what makes Node stop reading; resuming first would flush input that a
      // following prompt still has to read.
      expect(paused).toHaveBeenCalledOnce()
    } finally {
      process.stdin.off('pause', paused)
    }
  })

  test('leaves a TTY stdin alone', async () => {
    setStdinTTY(true)
    mockClack.confirm.mockResolvedValue(true)
    const paused = vi.fn()
    process.stdin.on('pause', paused)

    try {
      await promptConfirm({ message: 'Continue?' })

      expect(paused).not.toHaveBeenCalled()
      expect(resumeSpy).not.toHaveBeenCalled()
      expect(pauseSpy).not.toHaveBeenCalled()
    } finally {
      process.stdin.off('pause', paused)
    }
  })
})

describe('branding helpers', () => {
  test('intro prefixes the title with the Netlify glyph', () => {
    intro('Netlify Link')

    expect(mockClack.intro).toHaveBeenCalledOnce()
    expect(mockClack.intro.mock.calls[0]?.[0]).toContain('⬥')
    expect(mockClack.intro.mock.calls[0]?.[0]).toContain('Netlify Link')
  })

  test('write nothing when output is suppressed, so --json output stays machine-readable', () => {
    mockIsOutputSuppressed.mockReturnValue(true)

    intro('Netlify Link')
    outro('done')

    expect(mockClack.intro).not.toHaveBeenCalled()
    expect(mockClack.outro).not.toHaveBeenCalled()
  })
})
