import yoctoSpinner, { Spinner } from 'yocto-spinner'

const DOTS_SPINNER = {
  interval: 80,
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
}

/**
 * Creates a spinner with the following text
 */
export const startSpinner = ({ text }: { text: string }) =>
  yoctoSpinner({
    text,
    spinner: DOTS_SPINNER,
  }).start()

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
