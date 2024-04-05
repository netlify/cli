import logSymbols from 'log-symbols'
import ora, { Ora } from 'ora'

/**
 * Creates a spinner with the following text
 */
export const startSpinner = ({ text }: { text: string }) =>
  ora({
    text,
  }).start()

/**
 * Stops the spinner with the following text
 */
export const stopSpinner = ({ error, spinner, text }: { error: boolean; spinner: Ora; text?: string }) => {
  if (!spinner) {
    return
  }
  // TODO: refactor no package needed `log-symbols` for that
  const symbol = error ? logSymbols.error : logSymbols.success
  spinner.stopAndPersist({
    text,
    symbol,
  })
}

/**
 * Clears the spinner
 */
export const clearSpinner = ({ spinner }: { spinner: Ora }) => {
  if (spinner) {
    spinner.stop()
  }
}
