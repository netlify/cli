import { env } from 'process'

const latestBootstrapURL = 'https://650bfd807b21ed000893e25c--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
