export default () => new Response(`custom-generated favicon`)

export const config = {
  path: '/favicon.ico',
  method: 'GET',
}
