const cliPath = require('./cliPath')
const path = require('path')
const getPort = require('get-port')
const seedrandom = require('seedrandom')
const execa = require('execa')
const pidtree = require('pidtree')

// each process gets a starting port based on the pid
const rng = seedrandom(`${process.pid}`)
function getRandomPortStart(rng) {
  const startPort = Math.floor(rng() * 10000) + 10000 // 10000 to avoid collisions with frameworks ports
  return startPort
}

let currentPort = getRandomPortStart(rng)

const startServer = async ({ cwd, env = {} }) => {
  const tryPort = currentPort++
  const port = await getPort({ port: tryPort })
  const host = 'localhost'
  const url = `http://${host}:${port}`
  console.log(`Starting dev server on port: ${port} in directory ${path.basename(cwd)}`)
  const ps = execa(cliPath, ['dev', '-p', port], {
    cwd,
    env: { ...process.env, ...env },
    reject: false,
  })
  return new Promise((resolve, reject) => {
    ps.stdout.on('data', data => {
      if (data.toString().includes('Server now ready on')) {
        resolve({
          url,
          host,
          port,
          close: async () => {
            const pids = await pidtree(ps.pid).catch(() => [])
            pids.forEach(pid => () => {
              try {
                process.kill(pid)
              } catch (e) {
                // no-op
              }
            })
            ps.kill()
            await Promise.race([ps, new Promise(resolve => setTimeout(resolve, 1000))])
          },
        })
      }
    })

    let error = ''
    ps.stderr.on('data', data => {
      error = error + data.toString()
    })
    ps.on('close', code => {
      if (code !== 0) {
        console.error(error)
        reject(error)
      }
    })
  })
}

const startDevServer = async options => {
  const maxAttempts = 5
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const server = await startServer(options)
      return server
    } catch (e) {
      if (attempt === maxAttempts) {
        throw e
      }
      console.warn('Retrying startDevServer', e)
    }
  }
}

const withDevServer = async (options, testHandler) => {
  let server
  try {
    server = await startDevServer(options)
    return await testHandler(server)
  } finally {
    await server.close()
  }
}

module.exports = {
  withDevServer,
  startDevServer,
}
