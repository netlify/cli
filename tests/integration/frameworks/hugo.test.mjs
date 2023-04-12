import { expect, test } from 'vitest'

import { setupFixtureTests } from '../utils/fixture.mjs'
import got from '../utils/got.cjs'

setupFixtureTests({ fixture: 'hugo-site', devServer: true }, () => {
  test('should not infinite redirect when -d flag is passed', async ({ devServer: { url } }) => {
    const response = await got(`${url}/`).text()

    expect(response).toContain('Home page!')
  })
})
