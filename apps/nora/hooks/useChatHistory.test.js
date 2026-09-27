import { renderHook, waitFor, act } from '@testing-library/react'
import { useChatHistory } from './useChatHistory'

const CHATS = [
  { id: 'c1', title: 'Fractions', pinned: false, updated_at: 1 },
  { id: 'c2', title: 'Volcanoes', pinned: false, updated_at: 2 },
]

// A fake server: GET /api/chats lists CHATS, every mutation answers with `mutationOk`.
function fakeServer() {
  const server = { mutationOk: false }
  server.fetch = async (url, init = {}) => {
    const method = init.method || 'GET'
    if (method === 'GET') return { ok: true, status: 200, json: async () => CHATS }
    return server.mutationOk
      ? { ok: true, status: 200, json: async () => ({}) }
      : { ok: false, status: 500, json: async () => ({ error: 'boom' }) }
  }
  return server
}

async function renderLoaded(server) {
  global.fetch = server.fetch
  const hook = renderHook(() => useChatHistory())
  await waitFor(() => expect(hook.result.current.chats).toHaveLength(2))
  return hook
}

describe('useChatHistory mutations', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('keeps the chat unpinned and reports an error when the pin request fails', async () => {
    const { result } = await renderLoaded(fakeServer())

    let outcome
    await act(async () => {
      outcome = await result.current.pin('c1', true)
    })

    expect(outcome).toBe(false)
    expect(result.current.chats.find((c) => c.id === 'c1').pinned).toBe(false)
    expect(result.current.error).toBe("Couldn't update the chat. Please try again.")
  })

  it('keeps the chat in the list and reports an error when the delete request fails', async () => {
    const { result } = await renderLoaded(fakeServer())

    let outcome
    await act(async () => {
      outcome = await result.current.remove('c1')
    })

    expect(outcome).toBe(false)
    expect(result.current.chats.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(result.current.error).toBe("Couldn't delete the chat. Please try again.")
  })

  it('removes the chat and reports success when the delete request succeeds', async () => {
    const server = fakeServer()
    server.mutationOk = true
    const { result } = await renderLoaded(server)

    let outcome
    await act(async () => {
      outcome = await result.current.remove('c1')
    })

    expect(outcome).toBe(true)
    expect(result.current.chats.map((c) => c.id)).toEqual(['c2'])
    expect(result.current.error).toBeNull()
  })

  it('clears the error once a later mutation succeeds', async () => {
    const server = fakeServer()
    const { result } = await renderLoaded(server)

    await act(async () => {
      await result.current.pin('c1', true)
    })
    expect(result.current.error).not.toBeNull()

    server.mutationOk = true
    await act(async () => {
      await result.current.pin('c1', true)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.chats.find((c) => c.id === 'c1').pinned).toBe(true)
  })
})
