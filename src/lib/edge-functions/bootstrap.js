import { env } from 'process';
const latestBootstrapURL = 'https://656703bb61f20c00084a3479--edge.netlify.com/bootstrap/index-combined.ts';
export const getBootstrapURL = () => env.NETLIFY_EDGE_BOOTSTRAP || latestBootstrapURL;
