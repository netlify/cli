import AsciiTable from 'ascii-table'
import { OptionValues } from 'commander'

import { exit, log, logJson } from '../../utils/command-helpers.js'
import { getFunctions, getFunctionsDir } from '../../utils/functions/index.js'
import BaseCommand from '../base-command.js'

interface DeployedFunction {
  n?: string
}

const normalizeFunction = function (
  deployedFunctions: DeployedFunction[],
  {
    name,
    urlPath: url,
  }: {
    name: string
    urlPath: string
  },
) {
  const isDeployed = deployedFunctions.some((deployedFunction) => deployedFunction.n === name)
  return { name, url, isDeployed }
}

export const functionsList = async (options: OptionValues, command: BaseCommand) => {
  const { config, relConfigFilePath, siteInfo } = command.netlify

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- XXX(serhalp): fixed in stacked PR.
  const deploy = siteInfo.published_deploy ?? {}
  // @ts-expect-error(serhalp) Investigate. Either dead code or a type error in the API client package.
  const deployedFunctions = deploy.available_functions || []

  const functionsDir = getFunctionsDir({ options, config })

  if (typeof functionsDir === 'undefined') {
    log('Functions directory is undefined')
    log(`Please verify that 'functions.directory' is set in your Netlify configuration file ${relConfigFilePath}`)
    log('Refer to https://ntl.fyi/file-based-build-config for more information')
    exit(1)
  }

  const functions = await getFunctions(functionsDir)
  const normalizedFunctions = functions.map(normalizeFunction.bind(null, deployedFunctions))

  if (normalizedFunctions.length === 0) {
    log(`No functions found in ${functionsDir}`)
    exit()
  }

  if (options.json) {
    logJson(normalizedFunctions)
    exit()
  }

  // Make table
  log(`Based on local functions folder ${functionsDir}, these are the functions detected`)
  const table = new AsciiTable(`Netlify Functions (in local functions folder)`)
  table.setHeading('Name', 'URL', 'deployed')
  normalizedFunctions.forEach(({ isDeployed, name, url }) => {
    table.addRow(name, url, isDeployed ? 'yes' : 'no')
  })
  log(table.toString())
}
