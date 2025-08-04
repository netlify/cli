export default async (request) => {
  return new Response('header-regex-matched')
}

export const config = {
  path: '/header-regex',
  header: {
    'X-API-Key': '^api-key-\\d+$',
  },
}
