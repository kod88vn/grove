import { updateChat, deleteChat } from './chats'

function fakeFetch(response) {
  const calls = []
  const fn = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body })
    return response
  }
  fn.calls = calls
  return fn
}

const failed = { ok: false, status: 500, json: async () => ({ error: 'boom' }) }
const succeeded = { ok: true, status: 200, json: async () => ({}) }

describe('chat mutation API client', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('rejects updateChat when the server answers with an error status', async () => {
    global.fetch = fakeFetch(failed)
    await expect(updateChat('c1', { pinned: true })).rejects.toThrow('500')
  })

  it('rejects deleteChat when the server answers with an error status', async () => {
    global.fetch = fakeFetch(failed)
    await expect(deleteChat('c1')).rejects.toThrow('500')
  })

  it('sends a PATCH with the updates when updateChat succeeds', async () => {
    global.fetch = fakeFetch(succeeded)
    await updateChat('c1', { pinned: true })
    expect(global.fetch.calls).toEqual([
      { url: '/api/chats/c1', method: 'PATCH', body: JSON.stringify({ pinned: true }) },
    ])
  })

  it('sends a DELETE when deleteChat succeeds', async () => {
    global.fetch = fakeFetch(succeeded)
    await deleteChat('c1')
    expect(global.fetch.calls).toEqual([
      { url: '/api/chats/c1', method: 'DELETE', body: undefined },
    ])
  })
})
