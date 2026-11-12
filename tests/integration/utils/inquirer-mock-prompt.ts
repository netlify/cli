import { confirm } from '@inquirer/prompts'
import { vi } from 'vitest'

// Callers must mock the module in their own test file with `vi.mock('@inquirer/prompts')`,
// because `vi.mock` is hoisted per file.
export const mockConfirm = (answer: boolean) => vi.mocked(confirm).mockReset().mockResolvedValue(answer)

export const spyOnConfirm = () => vi.mocked(confirm).mockReset()
