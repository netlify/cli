export const getSiteByName = async (api, siteName) => {
  try {
    const sites = await api.listSites({ name: siteName, filter: 'all' })
    const siteFoundByName = sites.find((filteredSite) => filteredSite.name === siteName)
    return siteFoundByName
  } catch (error) {
    return { error }
  }
}
