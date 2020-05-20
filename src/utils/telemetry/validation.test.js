const test = require('ava')
const isValidEventName = require('./validation')

const getEventForProject = (projectName, eventName) => `${projectName}:${eventName}`

test('validate failed with eventName without underscore', t => {
  const projectName = 'testProject'
  const event = 'test'
  const config = {
    projectName,
    objects: ['test'],
  }
  const result = isValidEventName(getEventForProject(projectName, event), config)
  t.is(result, false)
})

test('validate failed with eventName without colon', t => {
  const projectName = 'testProject'
  const event = 'test_eventName'
  const config = {
    projectName,
    objects: ['test'],
  }
  const result = isValidEventName(`${projectName}${event}`, config)
  t.is(result, false)
})

test('validate pass with eventName with only underscore', t => {
  const projectName = 'testProject'
  const event = 'test_name'
  const config = {
    projectName,
    objects: ['test'],
  }
  const result = isValidEventName(getEventForProject(projectName, event), config)
  t.is(result, true)
})

test('validate pass with eventName with underscore and camelCase', t => {
  const projectName = 'testProject'
  const event = 'test_eventName'
  const config = {
    projectName,
    objects: ['test'],
  }
  const result = isValidEventName(getEventForProject(projectName, event), config)
  t.is(result, true)
})

test('project in event should be pass in config', t => {
  const projectName = 'anotherProjectName'
  const event = 'test_eventName'
  const config = {
    projectName: 'projectName',
    objects: ['test'],
  }
  const result = isValidEventName(getEventForProject(projectName, event), config)
  t.is(result, false)
})

test('object in event should be pass in config.objects', t => {
  const projectName = 'testProject'
  const event = 'event_eventName'
  const config = {
    projectName,
    objects: ['test'],
  }
  const result = isValidEventName(getEventForProject(projectName, event), config)
  t.is(result, false)
})
