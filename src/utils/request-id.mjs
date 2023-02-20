// @ts-check
import { v4 as generateUUID } from 'uuid'

// Transform a v4 UUID to match the format used in production — alphanumeric
// characters, all uppercase, 26 characters.
export const generateRequestID = () => generateUUID().replace(/-/g, '').toUpperCase().slice(0, 26)
