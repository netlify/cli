/**
 * The CLI's exit code dictionary.
 *
 * Contract:
 * - `1` is the legacy catch-all: any unclassified failure exits 1. Scripts must treat
 *   any non-zero exit as failure and may use the specific codes below for diagnosis.
 * - New, more specific codes are only ever adopted on paths that previously failed
 *   (exited non-zero). A previously succeeding invocation never starts failing, and a
 *   previously failing invocation never starts succeeding, because a code was added here.
 * - `netlify build` additionally passes through `@netlify/build` severity codes.
 *
 * The dictionary is surfaced in the root `netlify --help` epilogue.
 */
export const EXIT_CODES = {
  /** Command completed successfully */
  SUCCESS: 0,
  /** Legacy/unclassified failure (the historical catch-all) */
  GENERAL_ERROR: 1,
  /** Usage error: unknown command, unknown option, or bad arguments */
  USAGE_ERROR: 2,
  /** An interactive prompt was required but the session is non-interactive (CI or `--non-interactive`) */
  NON_INTERACTIVE_PROMPT: 4,
} as const

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES]
