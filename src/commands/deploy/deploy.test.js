const path = require('path')

const test = require('ava')
const mock = require('mock-fs')
const sinon = require('sinon')

const util = require('../../utils')

const mockDeploy = {
  id: '61c1bd9f3c980d007f6759db',
  name: 'condescending-goldwasser-faedd7',
  required: [],
  required_functions: [],
  site_id: 'df143b7d-19a6-44c1-87ed-6442c3916afc',
  ssl_url: 'https://condescending-goldwasser-faedd7.netlifystg.app',
}

const mockFunction = `
const { schedule } = require("@netlify/functions");

const handler = async function (event, context) {
  return {
    statusCode: 200,
    body: "Hello",
  };
};

module.exports.handler = schedule("* * * * *", handler);
`

mock({
  'netlify/functions/test-scheduled.js': mockFunction,
  node_modules: mock.load(path.resolve(__dirname, '../../../node_modules')),
  src: mock.load(path.resolve(__dirname, '../../../src')),
})

// eslint-disable-next-line require-await
const initMock = async () => {
  sinon.stub(util, 'uploadFiles').callsFake(async () => {})
  // eslint-disable-next-line require-await
  sinon.stub(util, 'waitForDeploy').callsFake(async () => mockDeploy)

  // const { NetlifyAPI } = await import('netlify')

  // eslint-disable-next-line require-await
  // sinon.stub(NetlifyAPI.prototype, 'createSiteDeploy').callsFake(async () => mockDeploy)

  // All mocking done.
  // eslint-disable-next-line node/global-require
  const { BaseCommand } = require('../base-command')

  // eslint-disable-next-line node/global-require
  const { createDeployCommand } = require('./index')

  const program = new BaseCommand('netlify')

  createDeployCommand(program)

  return program
}

test('replace me', async () => {
  const program = await initMock()

  // eslint-disable-next-line require-await
  sinon.stub(program.netlify, 'createSiteDeploy').callsFake(async () => mockDeploy)

  program.exitOverride().parse(['_', '_', 'deploy', '--prod', '--build'])
})
