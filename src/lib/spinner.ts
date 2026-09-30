import { createSpinner, type Spinner } from 'nanospinner'

import { isAccessible } from '../utils/prompts/accessible.js'

const argv = process.argv.slice(2)

const DOTS_SPINNER = {
  interval: 80,
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
}

const shouldSuppressOutput = () => argv.includes('--json') || argv.includes('--silent')

const noopSpinner: Spinner = {
  start: () => noopSpinner,
  stop: () => noopSpinner,
  success: () => noopSpinner,
  error: () => noopSpinner,
  warn: () => noopSpinner,
  info: () => noopSpinner,
  update: () => noopSpinner,
  reset: () => noopSpinner,
  clear: () => noopSpinner,
  spin: () => noopSpinner,
  write: () => noopSpinner,
  render: () => noopSpinner,
  loop: () => noopSpinner,
  isSpinning: () => false,
}

const textOf = (opts: { text?: string } | string | undefined): string | undefined =>
  typeof opts === 'string' ? opts : opts?.text

/**
 * Says what is happening once instead of animating it. A screen reader announces a terminal by reading
 * what is written to it, so an animation is read out again on every frame.
 */
const createStaticSpinner = (text: string): Spinner => {
  let current = text
  const announce = (opts?: { text?: string } | string): Spinner => {
    current = textOf(opts) ?? current
    process.stderr.write(`${current}\n`)
    return spinner
  }
  const spinner: Spinner = {
    ...noopSpinner,
    start: announce,
    stop: announce,
    success: announce,
    error: announce,
    warn: announce,
    info: announce,
    update: (opts) => {
      current = textOf(opts) ?? current
      return spinner
    },
  }
  return spinner
}

/**
 * Creates a spinner with the following text
 */
export const startSpinner = ({ text }: { text: string }): Spinner => {
  if (shouldSuppressOutput()) {
    return noopSpinner
  }
  if (isAccessible()) {
    return createStaticSpinner(text).start()
  }
  return createSpinner(text, DOTS_SPINNER).start()
}

/**
 * Stops the spinner with the following text
 */
export const stopSpinner = ({ error, spinner, text }: { error?: boolean; spinner: Spinner; text?: string }) => {
  if (!spinner) {
    return
  }
  if (error === true) {
    spinner.error(text)
  } else {
    spinner.stop(text)
  }
}

/**
 * Clears the spinner
 */
export const clearSpinner = ({ spinner }: { spinner: Spinner }) => {
  spinner.clear()
}

export type { Spinner }
