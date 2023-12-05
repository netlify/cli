import { expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../utils/fixture.js'
import fetch from 'node-fetch'

setupFixtureTests('hugo-site', { devServer: true }, () => {
  test<FixtureTestContext>('should not infinite redirect when -d flag is passed', async ({ devServer: { url } }) => {
    const response = await fetch(`${url}/`).then((res)=> res.text())

    expect(response).toContain('Home page!')
  })
})
