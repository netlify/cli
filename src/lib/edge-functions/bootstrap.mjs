import { env } from 'process'

const latestBootstrapURL = 'https://6539213a19a93a000876a033--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
