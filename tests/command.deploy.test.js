const test = require('ava')
const { getToken } = require('../src/utils/command')
const fetch = require('node-fetch')
const { withSiteBuilder } = require('./utils/siteBuilder')
const callCli = require('./utils/callCli')
const { generateSiteName, createLiveTestSite } = require('./utils/createLiveTestSite')

const siteName = generateSiteName('netlify-test-deploy-')

const validateDeploy = async ({ deploy, siteName, content, t }) => {
  t.truthy(deploy.site_name)
  t.truthy(deploy.deploy_url)
  t.truthy(deploy.deploy_id)
  t.truthy(deploy.logs)
  t.is(deploy.site_name, siteName)

  const actualContent = await fetch(deploy.deploy_url)
    .then(r => r.text())
    .catch(() => undefined)

  t.is(actualContent, content)
}

if (process.env.IS_FORK !== 'true') {
  test.before(async t => {
    const siteId = await createLiveTestSite(siteName)
    t.context.siteId = siteId
  })

  test.serial('should deploy site when dir flag is passed', async t => {
    await withSiteBuilder('site-with-public-folder', async builder => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder.withContentFile({
        path: 'public/index.html',
        content,
      })

      await builder.buildAsync()

      const deploy = await callCli(['deploy', '--json', '--dir', 'public'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      }).then(output => JSON.parse(output))

      validateDeploy({ deploy, siteName, content, t })
    })
  })

  test.serial('should deploy site when publish directory set in netlify.toml', async t => {
    await withSiteBuilder('site-with-public-folder', async builder => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
          },
        })

      await builder.buildAsync()

      const deploy = await callCli(['deploy', '--json'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      }).then(output => JSON.parse(output))

      validateDeploy({ deploy, siteName, content, t })
    })
  })

  // the edge handlers plugin only works on node >= 10 and not on windows at the moment
  const version = parseInt(process.version.substring(1).split('.')[0])
  if (process.platform !== 'win32' && version >= 10) {
    test.serial('should deploy edge handlers when directory exists', async t => {
      await withSiteBuilder('site-with-public-folder', async builder => {
        const content = '<h1>⊂◉‿◉つ</h1>'
        builder
          .withContentFile({
            path: 'public/index.html',
            content,
          })
          .withNetlifyToml({
            config: {
              build: { publish: 'public', command: 'echo "no op"' },
            },
          })
          .withEdgeHandlers({
            handlers: {
              onRequest: event => {
                console.log(`Incoming request for ${event.request.url}`)
              },
            },
          })

        await builder.buildAsync()

        const options = {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: t.context.siteId },
        }
        // build the edge handlers first
        await callCli(['build'], options)
        const deploy = await callCli(['deploy', '--json'], options).then(output => JSON.parse(output))

        validateDeploy({ deploy, siteName, content, t })

        // validate edge handlers
        // use this until we can use `netlify api`
        const [apiToken] = getToken()
        const resp = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.deploy_id}/edge_handlers`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`,
          },
        })

        t.is(resp.status, 200)
        const { created_at, sha, ...rest } = await resp.json()
        t.deepEqual(rest, {
          content_length: 445,
          content_type: 'application/javascript',
          handlers: ['index'],
          valid: true,
        })
      })
    })
  }

  test.after('cleanup', async t => {
    const { siteId } = t.context
    console.log(`deleting test site "${siteName}". ${siteId}`)
    await callCli(['sites:delete', siteId, '--force'])
  })
}
