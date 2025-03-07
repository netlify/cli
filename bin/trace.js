import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'

const interceptor = new ClientRequestInterceptor()

// Enable the interception of requests.
interceptor.apply()

// Listen to any "http.ClientRequest" being dispatched,
// and log its method and full URL.
interceptor.on('request', async ({ request, requestId }) => {
    const req = request.clone()
    let text = await req.text()
    if (text.includes('�')) {
        text = 'binary contents'
    }

    console.log('making request', request.method, request.url, req.headers, text)
})

// Listen to any responses sent to "http.ClientRequest".
// Note that this listener is read-only and cannot affect responses.
interceptor.on(
    'response',
    async ({ response, isMockedResponse, request, requestId }) => {
        const res = response.clone()
        let text = await res.text()
        if (text.includes('�')) {
            text = 'binary contents'
        }

        console.log('response to %s %s was:', request.method, request.url, res.headers, text)
    }
)