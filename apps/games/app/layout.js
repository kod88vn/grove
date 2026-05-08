import './globals.css'
import { AppHeader } from '../components/AppHeader'

export const metadata = {
  title: 'Grove Games',
  description: 'Grove family game arcade',
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
