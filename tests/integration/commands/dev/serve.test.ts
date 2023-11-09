import { expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'

setupFixtureTests('plugin-changing-publish-dir', { devServer: { serve: true } }, () => {
  test<FixtureTestContext>('ntl serve should respect plugins changing publish dir', async ({ devServer }) => {
    const response = await fetch(`http://localhost:${devServer.port}/`)
    expect(response.status).toBe(200)
  })
})
