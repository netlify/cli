import { env } from 'process'

const latestBootstrapURL = 'https://deploy-preview-294--edge.netlify.app/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
