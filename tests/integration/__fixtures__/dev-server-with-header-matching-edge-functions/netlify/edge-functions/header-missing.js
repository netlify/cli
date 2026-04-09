export default async (request) => {
  return new Response('header-missing-matched')
}

export const config = {
  path: '/header-missing',
  header: {
    'x-forbidden-header': false,
  },
}
