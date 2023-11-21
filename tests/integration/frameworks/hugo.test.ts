import { expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../utils/fixture.js'
import got from '../utils/got.js'

setupFixtureTests('hugo-site', { devServer: true }, () => {
  test<FixtureTestContext>('should not infinite redirect when -d flag is passed', async ({ devServer: { url } }) => {
    const response = await got(`${url}/`).text()

    expect(response).toContain('Home page!')
  })
})
