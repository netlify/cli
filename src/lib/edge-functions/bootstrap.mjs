import { env } from 'process'

const latestBootstrapURL = 'https://64523ab4e7865600087fc3df--edge.netlify.com/bootstrap/index-combined.ts'

export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL
