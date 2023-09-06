import { env } from 'process'

const latestBootstrapURL = 'https://64f73321fdd56900083fa618--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
