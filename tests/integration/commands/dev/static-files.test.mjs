import { describe, expect, test } from 'vitest'

import { setupFixtureTests } from '../../utils/fixture.mjs'

describe('dev command : static files', () => {
  setupFixtureTests({ devServer: true, fixture: 'dev-server-with-static-files' }, () => {
    test.concurrent('should redirect /folder to /folder/', async ({ devServer }) => {
      const response = await devServer.get('/folder', { followRedirect: false })

      expect(response.statusCode).toBe(301)
      expect(response.headers.location).toBe('/folder/')
    })

    test.concurrent('should redirect /folder to /folder/ with query params', async ({ devServer }) => {
      const response = await devServer.get('/folder?asdf', { followRedirect: false })

      expect(response.statusCode).toBe(301)
      expect(response.headers.location).toBe('/folder/?asdf')
    })

    test.concurrent('should redirect /file/ to /file', async ({ devServer }) => {
      const response = await devServer.get('/file/', { followRedirect: false })

      expect(response.statusCode).toBe(301)
      expect(response.headers.location).toBe('/file')
    })

    test.concurrent('should redirect /file/ to /file with query params', async ({ devServer }) => {
      const response = await devServer.get('/file/?asdf', { followRedirect: false })

      expect(response.statusCode).toBe(301)
      expect(response.headers.location).toBe('/file?asdf')
    })

    test.concurrent('should redirect /folder/index.html/ to /folder/', async ({ devServer }) => {
      const response = await devServer.get('/folder/index.html/', { followRedirect: false })

      expect(response.statusCode).toBe(301)
      expect(response.headers.location).toBe('/folder/')
    })

    test.concurrent('should redirect /file.html/ to /file', async ({ devServer }) => {
      const response = await devServer.get('/file.html/', { followRedirect: false })

      expect(response.statusCode).toBe(301)
      expect(response.headers.location).toBe('/file')
    })

    test.concurrent('should not redirect /folder/index.html', async ({ devServer }) => {
      const response = await devServer.get('/folder/index.html', { followRedirect: false })

      expect(response.statusCode).toBe(200)
    })

    test.concurrent('should not redirect /folder/', async ({ devServer }) => {
      const response = await devServer.get('/folder/', { followRedirect: false })

      expect(response.statusCode).toBe(200)
    })

    test.concurrent('should not redirect /file', async ({ devServer }) => {
      const response = await devServer.get('/file', { followRedirect: false })

      expect(response.statusCode).toBe(200)
    })

    test.concurrent('should not redirect /file.html', async ({ devServer }) => {
      const response = await devServer.get('/file.html', { followRedirect: false })

      expect(response.statusCode).toBe(200)
    })

    test.concurrent('should not redirect /file with spaces', async ({ devServer }) => {
      const response = await devServer.get('/file with spaces', { followRedirect: false })

      expect(response.statusCode).toBe(200)
    })
  })
})
