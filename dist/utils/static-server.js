import path from 'path';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { log, NETLIFYDEVLOG } from './command-helpers.js';
/**
 * @param {object} config
 * @param {import('./types.js').ServerSettings} config.settings
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'settings' implicitly has an 'any'... Remove this comment to see the full error message
export const startStaticServer = async ({ settings }) => {
    const server = Fastify();
    const rootPath = path.resolve(settings.dist);
    server.register(fastifyStatic, {
        root: rootPath,
        etag: false,
        acceptRanges: false,
        lastModified: false,
    });
    server.setNotFoundHandler((_req, res) => {
        res.code(404).sendFile('404.html', rootPath);
    });
    server.addHook('onRequest', (req, reply, done) => {
        reply.header('age', '0');
        reply.header('cache-control', 'public, max-age=0, must-revalidate');
        const validMethods = ['GET', 'HEAD'];
        if (!validMethods.includes(req.method)) {
            reply.code(405).send('Method Not Allowed');
        }
        done();
    });
    await server.listen({ port: settings.frameworkPort });
    const [address] = server.addresses();
    log(`\n${NETLIFYDEVLOG} Static server listening to`, settings.frameworkPort);
    return { family: address.family };
};
//# sourceMappingURL=static-server.js.map