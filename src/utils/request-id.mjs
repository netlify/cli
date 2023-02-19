// @ts-check
import { v4 as generateUUID } from 'uuid'

export const generateRequestID = () => generateUUID().replace(/-/gi, '').toUpperCase().slice(0, 26)
