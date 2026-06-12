import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AR Brochure',
  description: 'Point your camera at the brochure to watch it come alive',
  viewport: 'width=device-width, initial-scale=1, user-scalable=no',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black overflow-hidden">
        {children}
      </body>
    </html>
  )
}
