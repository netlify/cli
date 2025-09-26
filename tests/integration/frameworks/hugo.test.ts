import { expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../utils/fixture.js'

setupFixtureTests('hugo-site', { devServer: true }, () => {
  test<FixtureTestContext>('should not infinite redirect when -d flag is passed', async ({ devServer }) => {
    const response = await fetch(`${devServer?.url}/`).then((res) => res.text())

    expect(response).toContain('Home page!')
  })
})
