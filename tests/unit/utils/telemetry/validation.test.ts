import { describe, expect, test, vi } from 'vitest'

import isValidEventName from '../../../../src/utils/telemetry/validation.js'

const getEventForProject = (projectName: string, eventName: string) => `${projectName}:${eventName}`

vi.mock('../../../../src/utils/command-helpers.ts', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: () => {},
}))

describe('isValidEventName', () => {
  test('validate failed with eventName without underscore', () => {
    const projectName = 'testProject'
    const event = 'test'
    const config = {
      projectName,
      objects: ['test'],
    }
    const result = isValidEventName(getEventForProject(projectName, event), config)
    expect(result).toBe(false)
  })

  test('validate failed with eventName without colon', () => {
    const projectName = 'testProject'
    const event = 'test_eventName'
    const config = {
      projectName,
      objects: ['test'],
    }
    const result = isValidEventName(`${projectName}${event}`, config)
    expect(result).toBe(false)
  })

  test('validate pass with eventName with only underscore', () => {
    const projectName = 'testProject'
    const event = 'test_name'
    const config = {
      projectName,
      objects: ['test'],
    }
    const result = isValidEventName(getEventForProject(projectName, event), config)
    expect(result).toBe(true)
  })

  test('validate pass with eventName with underscore and camelCase', () => {
    const projectName = 'testProject'
    const event = 'test_eventName'
    const config = {
      projectName,
      objects: ['test'],
    }
    const result = isValidEventName(getEventForProject(projectName, event), config)
    expect(result).toBe(true)
  })

  test('project in event should be pass in config', () => {
    const projectName = 'anotherProjectName'
    const event = 'test_eventName'
    const config = {
      projectName: 'projectName',
      objects: ['test'],
    }
    const result = isValidEventName(getEventForProject(projectName, event), config)
    expect(result).toBe(false)
  })

  test('object in event should be pass in config.objects', () => {
    const projectName = 'testProject'
    const event = 'event_eventName'
    const config = {
      projectName,
      objects: ['test'],
    }
    const result = isValidEventName(getEventForProject(projectName, event), config)
    expect(result).toBe(false)
  })
})
