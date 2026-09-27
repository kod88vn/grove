import { renderHook, waitFor, act } from '@testing-library/react'
import { useChatHistory } from './useChatHistory'

const CHATS = [{ id: 'c1', title: 'Fractions', pinned: false, updated_at: 1 }]

// A fake server whose GET /api/chats and mutations can each be switched to fail.
function fakeServer() {
  const server = { listOk: true, mutationOk: true }
  server.fetch = async (url, init = {}) => {
    const ok = (init.method || 'GET') === 'GET' ? server.listOk : server.mutationOk
    return ok
      ? { ok: true, status: 200, json: async () => ((init.method || 'GET') === 'GET' ? CHATS : {}) }
      : { ok: false, status: 503, json: async () => ({ error: 'down' }) }
  }
  return server
}

describe('useChatHistory loading', () => {
  const originalFetch = global.fetch
  let consoleError

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
    consoleError.mockRestore()
  })

  it('reports an error, not an empty history, when the list fails to load', async () => {
    const server = fakeServer()
    server.listOk = false
    global.fetch = server.fetch

    const { result } = renderHook(() => useChatHistory())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.chats).toEqual([])
    expect(result.current.error).toBe("Couldn't load your chats. Please try again.")
    expect(consoleError).toHaveBeenCalled()
  })

  it('clears the load error once a later refresh succeeds', async () => {
    const server = fakeServer()
    server.listOk = false
    global.fetch = server.fetch

    const { result } = renderHook(() => useChatHistory())
    await waitFor(() => expect(result.current.error).not.toBeNull())

    server.listOk = true
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.chats).toEqual(CHATS)
  })

  it('logs the underlying failure when a mutation fails', async () => {
    const server = fakeServer()
    global.fetch = server.fetch

    const { result } = renderHook(() => useChatHistory())
    await waitFor(() => expect(result.current.chats).toEqual(CHATS))

    server.mutationOk = false
    await act(async () => {
      await result.current.remove('c1')
    })

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), expect.any(Error))
  })
})
