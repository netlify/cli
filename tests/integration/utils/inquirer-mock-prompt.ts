// tests/utils/inquirer-mock.ts
import inquirer from 'inquirer'
import { vi } from 'vitest'

export const mockPrompt = (response = { confirm: true }) => {
  // Create the mock function
  const mockFn = vi.fn().mockResolvedValue(response)

  // Preserve the original properties of inquirer.prompt
  Object.assign(mockFn, inquirer.prompt)

  // Create the spy with our prepared mock
  const spy = vi.spyOn(inquirer, 'prompt').mockImplementation(mockFn)

  inquirer.registerPrompt = vi.fn()
  inquirer.prompt.registerPrompt = vi.fn()

  return spy
}

export const spyOnMockPrompt = () => {
  return vi.spyOn(inquirer, 'prompt')
}
