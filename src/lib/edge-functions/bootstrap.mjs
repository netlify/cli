import { env } from 'process'

const latestBootstrapURL = 'https://643581608391e3000851cc94--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
