import { env } from 'process'

const latestBootstrapURL = 'https://64c264287e9cbb0008621df3--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
