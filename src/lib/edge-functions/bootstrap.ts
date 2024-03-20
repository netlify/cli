import { env } from 'process'

const latestBootstrapURL = 'https://65f9b38dc160de0008d35515--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
