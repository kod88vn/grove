import './globals.css'
import { NoraNav } from '@/components/NoraNav'
import { FloatingChat } from '@/components/FloatingChat'

export const metadata = {
  title: 'Nora',
  description: 'Your Grove family steward',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-50">
        <NoraNav />
        <div className="flex-1">{children}</div>
        <FloatingChat />
      </body>
    </html>
  )
}
