import execa from 'execa'

const CURL_TIMEOUT = 1e5

export const curl = async (url: string, args: string[] = []): Promise<string> => {
  const { stdout } = await execa('curl', [...args, url], { timeout: CURL_TIMEOUT })
  return stdout
}
