import { env } from 'process';
import execaLib from 'execa';
// This is a thin layer on top of `execa` that allows consumers to provide an
// alternative path to the module location, making it easier to mock its logic
// in tests (see `tests/integration/utils/mock-execa.ts`).
let execa;
if (env.NETLIFY_CLI_EXECA_PATH) {
    const execaMock = await import(env.NETLIFY_CLI_EXECA_PATH);
    execa = execaMock.default;
}
else {
    execa = execaLib;
}
export default execa;
//# sourceMappingURL=execa.js.map