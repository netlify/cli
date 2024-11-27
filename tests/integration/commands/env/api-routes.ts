import { HTTPMethod } from '../../utils/mock-api-vitest'

const siteInfo = {
  account_slug: 'test-account',
  build_settings: {
    env: {},
  },
  id: 'site_id',
  name: 'site-name',
}

export const secondSiteInfo = {
  account_slug: 'test-account-2',
  build_settings: {
    env: {},
  },
  id: 'site_id_2',
  name: 'site-name-2',
}

const thirdSiteInfo = {
  account_slug: 'test-account-3',
  build_settings: {
    env: {},
  },
  id: 'site_id_3',
  name: 'site-name-3',
}

export const existingVar = {
  key: 'EXISTING_VAR',
  scopes: ['builds', 'functions'],
  values: [
    {
      id: '1234',
      context: 'production',
      value: 'envelope-prod-value',
    },
    {
      id: '2345',
      context: 'dev',
      value: 'envelope-dev-value',
    },
  ],
  updated_at: '2020-01-01T00:00:00Z',
  is_secret: false,
}

const otherVar = {
  key: 'OTHER_VAR',
  scopes: ['builds', 'functions', 'runtime', 'post_processing'],
  values: [
    {
      id: '3456',
      context: 'all',
      value: 'envelope-all-value',
    },
  ],
}

const response = [existingVar, otherVar]
const secondSiteResponse = [existingVar]

export const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id_2', response: secondSiteInfo },
  { path: 'sites/site_id_3', response: thirdSiteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR',
    response: existingVar,
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR',
    response: otherVar,
  },
  {
    path: 'accounts/test-account/env/SOME_VAR',
    status: 404,
  },
  {
    path: 'accounts/test-account/env',
    response,
  },
  {
    path: 'accounts/test-account-2/env/EXISTING_VAR',
    response: existingVar,
  },
  {
    path: 'accounts/test-account-2/env',
    response: secondSiteResponse,
  },
  {
    path: 'accounts/test-account-3/env',
    response: [{}],
  },
  {
    path: 'accounts/test-account/env',
    method: HTTPMethod.POST,
    response: {},
  },
  {
    path: 'accounts/test-account-2/env',
    method: HTTPMethod.POST,
    response: {},
  },
  {
    path: 'accounts/test-account-3/env',
    method: HTTPMethod.POST,
    response: {},
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR',
    method: HTTPMethod.PUT,
    response: {},
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR',
    method: HTTPMethod.PATCH,
    response: {},
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR',
    method: HTTPMethod.DELETE,
    response: {},
  },
  {
    path: 'accounts/test-account-2/env/EXISTING_VAR',
    method: HTTPMethod.DELETE,
    response: {},
  },
  {
    path: 'accounts/test-account-3/env/EXISTING_VAR',
    method: HTTPMethod.DELETE,
    response: {},
  },
  {
    path: 'accounts/test-account/env/EXISTING_VAR/value/1234',
    method: HTTPMethod.DELETE,
    response: {},
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR',
    method: HTTPMethod.PATCH,
    response: {},
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR',
    method: HTTPMethod.PUT,
    response: {},
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR',
    method: HTTPMethod.DELETE,
    response: {},
  },
  {
    path: 'accounts/test-account/env/OTHER_VAR/value/3456',
    method: HTTPMethod.DELETE,
    response: {},
  },
]

export default routes
