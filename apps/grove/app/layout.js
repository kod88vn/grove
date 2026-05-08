import './globals.css'
import { AppHeader } from '../components/AppHeader'

export const metadata = {
  title: 'Grove',
  description: 'Grove family apps',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <AppHeader />
        {children}
      </body>
    </html>
  )
}
