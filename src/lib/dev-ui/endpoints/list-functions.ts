import { Request as ExpressRequest, Response as ExpressResponse } from 'express'

import NetlifyFunction from '../../functions/netlify-function.js'
import { UIContext } from '../context.js'

export const listFunctions = async (context: UIContext, _: ExpressRequest, res: ExpressResponse) => {
  const { functionsRegistry } = context

  // TODO a lot of typescript (as any) hackery to access private properties- should maybe add some kind of `serialize` method on NetlifyFunction/FunctionsRegistry
  const functions = Array.from((functionsRegistry as any).functions.values() as NetlifyFunction[]).map(
    (func: NetlifyFunction) => {
      return {
        name: func.name,
        displayName: func.displayName,
        mainFile: func.mainFile.replace((func as any).projectRoot, ''),
        routes: (func as any).buildData.routes,
        // @ts-expect-error
        config: func.config,
      }
    },
  )

  res.json({
    functions,
  })
}
