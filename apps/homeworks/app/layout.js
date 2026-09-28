import './globals.css'
import { AppHeader } from '../components/AppHeader'
import { KidSettingsProvider } from '../components/KidSettingsProvider'

export const metadata = {
  title: 'Grove Homeworks',
  description: 'Grove family homeworks tracker',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-50">
        <KidSettingsProvider>
          <AppHeader />
          <div className="flex-1">{children}</div>
        </KidSettingsProvider>
      </body>
    </html>
  )
}
