import { server } from "./mswServer"
import {beforeAll, afterAll} from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
