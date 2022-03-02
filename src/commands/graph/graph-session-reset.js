// @ts-check
const { OneGraphCliClient, loadCLISession } = require('../../lib/one-graph/cli-client')
const { error, warn } = require('../../utils')

/**
 * Creates the `netlify graph:session:reset` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphSessionReset = async (options, command) => {
    const { site, state } = command.netlify
    const siteId = site.id
    const netlifyToken = await command.authenticate()
    const oneGraphSessionId = loadCLISession(state)

    if (!oneGraphSessionId) {
        error(`No local Netlify Graph session found, unable to reset.`)
    }

    const helper = async () => {
        const next = await OneGraphCliClient.fetchCliSessionEvents({ appId: siteId, authToken: netlifyToken, sessionId: oneGraphSessionId })

        if (next.errors) {
            next.errors.forEach((fetchEventError) => {
                warn(JSON.stringify(fetchEventError, null, 2))
            })
        }

        const { events } = next

        if (events.length !== 0) {
            const ackIds = events.map((event) => event.id);

            try {
                await OneGraphCliClient.ackCLISessionEvents({ appId: siteId, authToken: netlifyToken, sessionId: oneGraphSessionId, eventIds: ackIds })
            } catch (ackEventsError) {
                warn(`Error resetting event: ${ackEventsError}`)
                return
            }

            return helper()
        }
    }

    await helper()
}

/**
 * Creates the `netlify graph:session:reset` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphSessionResetCommand = (program) =>
    program
        .command('graph:session:reset')
        .description('Drain the current session event queue, ignoring them. Useful for resetting the state of the client.')
        .action(async (options, command) => {
            await graphSessionReset(options, command)
        })

module.exports = { createGraphSessionResetCommand }
