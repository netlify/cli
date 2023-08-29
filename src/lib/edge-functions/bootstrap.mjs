import { env } from 'process'

const latestBootstrapURL = 'https://64e7783fce8cfe0008496c72--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
