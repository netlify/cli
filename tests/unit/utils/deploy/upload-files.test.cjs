const test = require('ava')
const sinon = require('sinon')
const { v4: generateUUID } = require('uuid')

const { uploadFiles } = require('../../../../src/utils/deploy/upload-files.cjs')

test('Adds a retry count to function upload requests', async (t) => {
  const uploadDeployFunction = sinon.stub()
  const mockError = new Error('Uh-oh')

  mockError.status = 500

  uploadDeployFunction.onCall(0).throws(mockError)
  uploadDeployFunction.onCall(1).throws(mockError)
  uploadDeployFunction.onCall(2).resolves()

  const mockApi = {
    uploadDeployFunction,
  }
  const deployId = generateUUID()
  const files = [
    {
      assetType: 'function',
      filepath: '/some/path/func1.zip',
      normalizedPath: 'func1.zip',
      runtime: 'js',
    },
  ]
  const options = {
    concurrentUpload: 1,
    maxRetry: 3,
    statusCb: sinon.stub(),
  }

  await uploadFiles(mockApi, deployId, files, options)

  t.is(uploadDeployFunction.callCount, 3)
  t.is(uploadDeployFunction.firstCall.args[0].xNfRetryCount, undefined)
  t.is(uploadDeployFunction.secondCall.args[0].xNfRetryCount, 1)
  t.is(uploadDeployFunction.thirdCall.args[0].xNfRetryCount, 2)
})
