// TODO: This should be replaced with a proper type for the entire API response
// for the site endpoint.
// See https://github.com/netlify/build/pull/5308.
export interface SiteInfo {
  admin_url?: string
  id: string
  name: string
  ssl_url?: string
  url: string
}
