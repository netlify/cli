import { StateConfig } from "../types.js";
import { SiteInfo } from "../api-types.js";

export interface PersistStateParams {
    siteInfo: SiteInfo,
    state: StateConfig
  }