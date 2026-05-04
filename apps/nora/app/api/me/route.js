import { headers } from 'next/headers'

export async function GET() {
  const h = await headers()
  const login = h.get('tailscale-user-login') || null
  const name = h.get('tailscale-user-name') || null
  const pic = h.get('tailscale-user-profile-pic') || null

  return Response.json({ login, name, pic })
}
