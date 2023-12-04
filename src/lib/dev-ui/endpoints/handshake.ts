import { Request as ExpressRequest, Response as ExpressResponse } from 'express'

import getPackageJson from '../../../utils/get-package-json.js'

const { name, version } = await getPackageJson()

const FEATURES = [
  {
    name: 'create-function',
    endpoint: '/function',
    version: 1,
  },
]

export const handleHandshake = (_: ExpressRequest, res: ExpressResponse) => {
  res.json({ name, version, features: FEATURES })
}
