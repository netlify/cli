import { createSpinner, type Spinner } from 'nanospinner'

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

/**
 * Creates a spinner with the following text
 */
export const startSpinner = ({ text }: { text: string }): Spinner => {
  if (shouldSuppressOutput()) {
    return noopSpinner
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
