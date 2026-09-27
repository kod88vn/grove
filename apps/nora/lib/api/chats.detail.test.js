import { fetchChatDetail } from './chats'

function fakeFetch(response) {
  return async () => response
}

describe('fetchChatDetail', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('rejects when the server answers with an error status', async () => {
    global.fetch = fakeFetch({ ok: false, status: 404, json: async () => ({ error: 'gone' }) })
    await expect(fetchChatDetail('c1')).rejects.toThrow('Failed to load chat: 404')
  })

  it('resolves with the chat detail when the request succeeds', async () => {
    const detail = { id: 'c1', messages: [{ role: 'user', content: 'hi' }] }
    global.fetch = fakeFetch({ ok: true, status: 200, json: async () => detail })
    await expect(fetchChatDetail('c1')).resolves.toEqual(detail)
  })
})
