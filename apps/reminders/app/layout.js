import './globals.css'
import { AppHeader } from '../components/AppHeader'

export const metadata = {
  title: 'Grove Reminders',
  description: 'Grove family reminders and routines',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-50">
        <AppHeader />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  )
}
