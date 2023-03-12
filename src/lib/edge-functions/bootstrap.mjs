import { env } from 'process'

const latestBootstrapURL = 'https://640b5b066a2b9b0008e88cb0--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
