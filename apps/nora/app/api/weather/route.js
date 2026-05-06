import { NextResponse } from 'next/server'
import { fetchWeather } from '@/lib/api/weather'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const location = searchParams.get('location') || process.env.WEATHER_LOCATION || 'Duluth, GA'

  const payload = await fetchWeather(location)
  
  if (!payload) {
    return NextResponse.json({ error: 'Weather service unavailable' }, { status: 502 })
  }

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=120',
    },
  })
}
