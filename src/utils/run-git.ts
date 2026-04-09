import execa from './execa.js'

export const runGit = async (args: string[], quiet: boolean) => {
  await execa('git', args, {
    ...(quiet ? {} : { stdio: 'inherit' }),
  })
}
