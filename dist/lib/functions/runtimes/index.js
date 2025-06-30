import * as go from './go/index.js';
import * as js from './js/index.js';
import * as rust from './rust/index.js';
const runtimes = {
    [go.name]: go,
    [js.name]: js,
    [rust.name]: rust,
};
export default runtimes;
//# sourceMappingURL=index.js.map