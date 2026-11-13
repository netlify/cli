import { vi } from 'vitest'

import * as prompts from '../../../src/utils/prompts/index.js'

export const mockConfirmPrompt = (answer = true) => vi.spyOn(prompts, 'promptConfirm').mockResolvedValue(answer)

export const spyOnConfirmPrompt = () => vi.spyOn(prompts, 'promptConfirm')
