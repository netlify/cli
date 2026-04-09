import type { BaseOptionValues } from '../base-command.js'

export type CloneOptionValues = BaseOptionValues & {
  // NOTE(serhalp): Think this would be better off as `siteId`? Beware, here be dragons.
  // There's some magical global state mutation dance going on somewhere when you call
  // an option `--site-id`. Good luck, friend.
  id?: string | undefined
  name?: string | undefined
}
