import { env } from 'process'

const latestBootstrapURL = 'https://64109c4552d9020008b9dadc--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
