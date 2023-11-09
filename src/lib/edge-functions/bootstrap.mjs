import { env } from 'process';
const latestBootstrapURL = 'https://65437779a0c9990008b54abe--edge.netlify.com/bootstrap/index-combined.ts';
export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL;
