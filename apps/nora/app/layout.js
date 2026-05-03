import './globals.css'

export const metadata = {
  title: 'Nora',
  description: 'Your Grove family steward',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
