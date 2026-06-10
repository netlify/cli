interface ApiErrorBody {
  code?: number
  message?: string
}

export const readApiErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text()
  if (!text) {
    return ''
  }
  try {
    const body = JSON.parse(text) as ApiErrorBody
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message
    }
  } catch {
    // body is not JSON; fall through to raw text
  }
  return text
}
