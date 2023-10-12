import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { pause } from '../../utils/pause.cjs'

describe('pubsub', () => {
  setupFixtureTests('dev-server-for-pubsub', { devServer: true }, () => {
    test<FixtureTestContext>('pubsub flow', async ({ devServer }) => {
      const subscriptionController = new AbortController()
      const url = `http://localhost:${devServer.port}/.netlify/pubsub/events`
      const subscription = await fetch(url, { signal: subscriptionController.signal })
      expect(subscription.headers.get('content-type')).toEqual('text/event-stream')

      const events: string[] = []
      subscription.body
        ?.pipeTo(
          new WritableStream({
            write(chunk) {
              events.push(new TextDecoder().decode(chunk))
            },
          }),
        )
        // eslint-disable-next-line promise/prefer-await-to-callbacks,promise/prefer-await-to-then
        .catch((error) => {
          expect(error.message).toEqual('The operation was aborted.')
        })

      const unauthenticated = await fetch(url, {
        method: 'POST',
        body: 'foo',
      })
      expect(unauthenticated.status).toBe(401)
      expect(events).toEqual(['event: ping\n\n'])

      const authenticated = await fetch(`http://localhost:${devServer.port}/.netlify/pubsub/events`, {
        method: 'POST',
        body: 'foo',
        headers: {
          Authorization: 'Bearer foo',
        },
      })
      expect(authenticated.status).toEqual(202)

      await pause(10)
      expect(events).toEqual(['event: ping\n\n', 'data: foo\n\n'])

      subscriptionController.abort()
    })
  })
})
