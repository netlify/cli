// @ts-expect-error TS(1259) FIXME: Module '"/home/ndhoule/dev/src/github.com/netlify/... Remove this comment to see the full error message
import execa from 'execa'

const CURL_TIMEOUT = 1e5

export const curl = async (url, args) => {
  const { stdout } = await execa('curl', [...args, url], { timeout: CURL_TIMEOUT })
  return stdout
}
