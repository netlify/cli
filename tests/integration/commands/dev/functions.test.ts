import { test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

test('nodeModuleFormat: esm v1 functions should work', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          plugins: [{ package: './plugins/setup-functions' }],
        },
      })
      .withBuildPlugin({
        name: 'setup-functions',
        plugin: {
          onBuild: async () => {
            const { mkdir, writeFile } = require('node:fs/promises')
            await mkdir('.netlify/functions-internal', { recursive: true })
            await writeFile(
              '.netlify/functions-internal/server.json',
              JSON.stringify({
                config: {
                  nodeModuleFormat: 'esm',
                },
                version: 1,
              }),
            )

            await writeFile(
              '.netlify/functions-internal/server.mjs',
              `
              export async function handler(event, context) {
                return {
                  statusCode: 200,
                  body: "This is an internal function.",
                };
              }
              `,
            )
          },
        },
      })
      .build()

    await withDevServer({ cwd: builder.directory, serve: true }, async (server) => {
      const response = await fetch(new URL('/.netlify/functions/server', server.url))
      t.expect(await response.text()).toBe('This is an internal function.')
      t.expect(response.status).toBe(200)
    })
  })
})

test('should inject environment variables from config to functions', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          build: { environment: { MY_CONFIG_ENV: 'FROM_CONFIG' } },
          functions: { directory: 'functions' },
        },
      })
      .withFunction({
        path: 'echo-config-env.js',
        handler: () => {
          return Promise.resolve({
            statusCode: 200,
            body: process.env.MY_CONFIG_ENV || 'NOT_FOUND',
          })
        },
      })
      .build()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await fetch(new URL('/.netlify/functions/echo-config-env', server.url))
      t.expect(await response.text()).toBe('FROM_CONFIG')
      t.expect(response.status).toBe(200)
    })
  })
})

test('should inject environment variables from build event handlers to functions', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          build: { environment: { EXISTING_VAR: 'existing_value' } },
          plugins: [{ package: './plugins/add-env-vars' }],
          functions: { directory: 'functions' },
        },
      })
      .withBuildPlugin({
        name: 'add-env-vars',
        plugin: {
          onPreDev({ netlifyConfig }) {
            // Simulate a build event handler adding environment variables to the config
            // This is how plugins can add environment variables that should be available to functions
            netlifyConfig.build.environment.MY_PLUGIN_ENV = 'FROM_BUILD_EVENT_HANDLER'
          },
        },
      })
      .withFunction({
        path: 'echo-plugin-env.js',
        handler: () => {
          return Promise.resolve({
            statusCode: 200,
            body: JSON.stringify({
              MY_PLUGIN_ENV: process.env.MY_PLUGIN_ENV ?? 'NOT_FOUND',
              EXISTING_VAR: process.env.EXISTING_VAR ?? 'NOT_FOUND',
            }),
          })
        },
      })
      .build()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await fetch(new URL('/.netlify/functions/echo-plugin-env', server.url))
      const result = (await response.json()) as { MY_PLUGIN_ENV: string; EXISTING_VAR: string }

      // First verify that existing environment variables work
      t.expect(result.EXISTING_VAR).toBe('existing_value')

      // Then verify that build event handler environment variables work
      t.expect(result.MY_PLUGIN_ENV).toBe('FROM_BUILD_EVENT_HANDLER')
      t.expect(response.status).toBe(200)
    })
  })
})

test('should inject environment variables from config to V2 functions', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          build: { environment: { MY_CONFIG_ENV: 'FROM_CONFIG_V2' } },
          functions: { directory: 'functions' },
        },
      })
      .withFunction({
        path: 'echo-config-env-v2.js',
        runtimeAPIVersion: 2, // This makes it a V2 function
        handler: () => {
          return new Response(process.env.MY_CONFIG_ENV ?? 'NOT_FOUND', {
            status: 200,
          })
        },
      })
      .build()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await fetch(new URL('/.netlify/functions/echo-config-env-v2', server.url))
      t.expect(await response.text()).toBe('FROM_CONFIG_V2')
      t.expect(response.status).toBe(200)
    })
  })
})

test('should inject environment variables from build event handlers to V2 functions', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          build: { environment: { EXISTING_VAR: 'existing_value_v2' } },
          plugins: [{ package: './plugins/add-env-vars-v2' }],
          functions: { directory: 'functions' },
        },
      })
      .withBuildPlugin({
        name: 'add-env-vars-v2',
        plugin: {
          onPreDev({ netlifyConfig }) {
            // Simulate a build event handler adding environment variables to the config
            netlifyConfig.build.environment.MY_PLUGIN_ENV = 'FROM_BUILD_EVENT_HANDLER_V2'
          },
        },
      })
      .withFunction({
        path: 'echo-plugin-env-v2.js',
        runtimeAPIVersion: 2, // This makes it a V2 function
        handler: () => {
          return new Response(
            JSON.stringify({
              MY_PLUGIN_ENV: process.env.MY_PLUGIN_ENV ?? 'NOT_FOUND',
              EXISTING_VAR: process.env.EXISTING_VAR ?? 'NOT_FOUND',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        },
      })
      .build()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await fetch(new URL('/.netlify/functions/echo-plugin-env-v2', server.url))
      const result = (await response.json()) as { MY_PLUGIN_ENV: string; EXISTING_VAR: string }

      // First verify that existing environment variables work
      t.expect(result.EXISTING_VAR).toBe('existing_value_v2')

      // Then verify that build event handler environment variables work
      t.expect(result.MY_PLUGIN_ENV).toBe('FROM_BUILD_EVENT_HANDLER_V2')
      t.expect(response.status).toBe(200)
    })
  })
})

test('should respect environment variable precedence for both V1 and V2 functions', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          build: { environment: { TEST_PRECEDENCE: 'FROM_CONFIG' } },
          plugins: [{ package: './plugins/precedence-test' }],
          functions: { directory: 'functions' },
        },
      })
      .withBuildPlugin({
        name: 'precedence-test',
        plugin: {
          onPreDev({ netlifyConfig }) {
            netlifyConfig.build.environment.TEST_PRECEDENCE = 'FROM_BUILD_EVENT_HANDLER'
          },
        },
      })
      .withFunction({
        path: 'precedence-v1.js',
        handler: () => {
          return Promise.resolve({
            statusCode: 200,
            body: process.env.TEST_PRECEDENCE ?? 'NOT_FOUND',
          })
        },
      })
      .withFunction({
        path: 'precedence-v2.js',
        runtimeAPIVersion: 2,
        handler: () => {
          return new Response(process.env.TEST_PRECEDENCE ?? 'NOT_FOUND', {
            status: 200,
          })
        },
      })
      .build()

    await withDevServer(
      {
        cwd: builder.directory,
        env: { TEST_PRECEDENCE: 'FROM_PROCESS_ENV' }, // Process env should override config
      },
      async (server) => {
        // Test V1 function
        const v1Response = await fetch(new URL('/.netlify/functions/precedence-v1', server.url))
        t.expect(await v1Response.text()).toBe('FROM_PROCESS_ENV')
        t.expect(v1Response.status).toBe(200)

        // Test V2 function
        const v2Response = await fetch(new URL('/.netlify/functions/precedence-v2', server.url))
        t.expect(await v2Response.text()).toBe('FROM_PROCESS_ENV')
        t.expect(v2Response.status).toBe(200)
      },
    )
  })
})
