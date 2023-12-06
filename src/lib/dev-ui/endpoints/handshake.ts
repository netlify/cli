import { Request as ExpressRequest, Response as ExpressResponse } from 'express'

import getPackageJson from '../../../utils/get-package-json.js'
import { UIContext } from '../context.js'

const { name, version } = await getPackageJson()

const FEATURES = [
  {
    name: 'create-function',
    endpoint: '/function',
    version: 1,
  },
]

export const handleHandshake = (context: UIContext, _: ExpressRequest, res: ExpressResponse) => {
  res.json({
    name,
    version,
    features: FEATURES,
    siteId: context.site?.id,
    siteName: context.siteInfo?.name,
    userId: context.globalConfig.get('userId'),
  })
}
