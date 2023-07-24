import { env } from 'process'

const latestBootstrapURL = 'https://64ae60d920fd0f000865bcfc--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
