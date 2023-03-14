import { env } from 'process'

const latestBootstrapURL = 'https://641064c685071e00083eb682--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
