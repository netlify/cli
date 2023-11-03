import { server } from "./mswServer"
import {beforeAll, afterAll} from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterAll(() => server.close())
