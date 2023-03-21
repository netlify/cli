import { env } from 'process'

const latestBootstrapURL = 'https://6419767d9dc968000848742a--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
