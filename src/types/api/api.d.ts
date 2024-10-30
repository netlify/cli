import type { NetlifyAPI } from 'netlify'
import { 
  GetEnvVarParams,
  GetEnvParams,
  DeleteEnvVarValueParams,
  SetEnvVarValueParams,
  UpdateEnvVarParams,
  createEnvVarParams,
  EnvVar
} from './env.js'

import {
  GetSiteParams,
  CreateSiteInTeamParams,
  ListSitesParams,
  SiteInfo
} from './sites.js'

import { 
  CancelSiteDeployParams
} from '../types/api/site-deploy.d.ts'

export interface ExtendedNetlifyAPI extends NetlifyAPI {
  getEnvVar(params: GetEnvVarParams): Promise<EnvVar>
  getEnvVars( params: GetEnvParams): Promise<EnvVar[]>
  deleteEnvVarValue( params: DeleteEnvVarValueParams  ): Promise<void>
  setEnvVarValue( params: SetEnvVarValueParams): Promise<EnvVar>
  deleteEnvVar(params: DeleteEnvVarValueParams): Promise<void>
  updateEnvVar(params: UpdateEnvVarParams): Promise<EnvVar>
  createEnvVars(params: createEnvVarParams): Promise<EnvVar[]>
  getSite(params: GetSiteParams): Promise<SiteInfo>
  createSiteInTeam(params: CreateSiteInTeamParams): Promise<SiteInfo>
  listSites(params: ListSitesParams): Promise<SiteInfo[]>
  cancelSiteDeploy(params: CancelSiteDeployParams): Promise<void>
  listServiceInstancesForSite(params: {siteId: string}): Promise<ServiceInstance[]>
}
