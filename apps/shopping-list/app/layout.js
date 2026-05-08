import './globals.css'
import { AppHeader } from '../components/AppHeader'

export const metadata = {
  title: 'Grove Shopping List',
  description: 'Grove family shopping list',
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
