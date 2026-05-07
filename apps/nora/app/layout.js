import { Suspense } from 'react'
import './globals.css'
import { NoraNav } from '@/components/NoraNav'
import { FloatingChat } from '@/components/FloatingChat'

export const metadata = {
  title: 'Nora',
  description: 'Your Grove family steward',
}

function DevBadge() {
  if (process.env.NODE_ENV !== 'development') return null
  const hash = process.env.NEXT_PUBLIC_COMMIT_HASH || 'dev'
  const rawDate = process.env.NEXT_PUBLIC_COMMIT_DATE || ''
  const date = rawDate ? new Date(rawDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <div className="fixed top-2 right-2 z-[9999] flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/95 px-2.5 py-0.5 font-mono text-[10px] text-amber-700 shadow backdrop-blur pointer-events-none select-none">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
      <span>{hash}</span>
      {date && <span className="text-amber-500">{date}</span>}
    </div>
  )
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-50">
        <DevBadge />
        <Suspense><NoraNav /></Suspense>
        <div className="flex-1">{children}</div>
        <Suspense><FloatingChat /></Suspense>
      </body>
    </html>
  )
}
