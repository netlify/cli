import type { CompletionItem } from '@pnpm/tabtab'

import { getPathInHome } from '../settings.js'

export const AUTOCOMPLETION_FILE = getPathInHome(['autocompletion.json'])

export interface CommandCompletion extends CompletionItem {
  options: CompletionItem[]
}

/** Contents of {@link AUTOCOMPLETION_FILE}, keyed by command name */
export type AutocompletionData = Record<string, CommandCompletion>
