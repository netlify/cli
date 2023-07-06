import { env } from 'process'

const latestBootstrapURL = 'https://6494585a67d46e0008867e60--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
