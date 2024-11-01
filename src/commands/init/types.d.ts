import { StateConfig } from "../types.js";
import { SiteInfo } from "../../types/api/api.js";

export interface PersistStateParams {
    siteInfo: SiteInfo,
    state: StateConfig
  }

export interface LogExistingAndExitParams {
  siteInfo: SiteInfo
}

export interface CreateNewSiteAndExitParams {
  state: StateConfig
  command: BaseCommand
}

export interface HandleNoGitRemoteAndExitParams {
  command: BaseCommand
  error: string
  state: StateConfig
}

export interface LogExistingRepoSetupAndExitParams {
  repoUrl: string
  siteName: string
}

